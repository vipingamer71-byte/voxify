import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  MessageSquarePlus,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { LANGUAGES, getLanguageById } from '../data/languages';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { streamAssistantChat } from '../services/api';
import { countWords } from '../services/speechEngine';
import type {
  ActivityEvent,
  AiAssistantMode,
  ChatConversation,
  ChatMessage,
  CustomMode,
  VocabularyItem,
  VoxifySettings,
} from '../types/voxify';

interface AiAssistantViewProps {
  settings: VoxifySettings;
  vocabulary: VocabularyItem[];
  customModes: CustomMode[];
  chats: ChatConversation[];
  hasMoreChats: boolean;
  onLoadMoreChats: () => void;
  onSaveChat: (conv: ChatConversation, isNew: boolean) => Promise<void>;
  onDeleteChat: (chatId: string) => Promise<void>;
  onLogActivity: (event: Omit<ActivityEvent, 'id' | 'date'>) => void;
}

const AI_MODES: AiAssistantMode[] = [
  'General Assistant',
  'Professional',
  'Developer',
  'Hinglish',
  'Email Writer',
  'Casual Chat',
  'Translator',
  'Summarizer',
  'Custom Mode',
];

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  settings,
  vocabulary,
  customModes,
  chats,
  hasMoreChats,
  onLoadMoreChats,
  onSaveChat,
  onDeleteChat,
  onLogActivity,
}) => {
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id || null);
  const [selectedMode, setSelectedMode] = useState<AiAssistantMode>('General Assistant');
  const [selectedCustomModeId, setSelectedCustomModeId] = useState<string>(
    customModes[0]?.id || ''
  );
  const [translatorLangId, setTranslatorLangId] = useState<string>('es-ES');
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

  const voiceInput = useVoiceDictation({
    languageId: settings.voice.speechLanguageId,
    continuous: false,
    interimResults: true,
    selectedMicId: settings.voice.selectedMicId,
    vocabulary,
    applyVocabulary: settings.voice.applyCustomVocabulary,
  });

  useEffect(() => {
    if (voiceInput.finalText.trim()) {
      setInput((prev) => {
        const spoken = voiceInput.finalText.trim();
        return prev ? `${prev.trim()} ${spoken}` : spoken;
      });
      voiceInput.setFinalText('');
    }
  }, [voiceInput.finalText, voiceInput.setFinalText]);

  const activeChat = chats.find((c) => c.id === activeId) || null;

  useEffect(() => {
    if (!activeId && chats[0]) {
      setActiveId(chats[0].id);
    }
  }, [activeId, chats]);

  useEffect(() => {
    if (activeChat) {
      setSelectedMode(activeChat.mode);
    }
  }, [activeChat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeChat?.messages.length, streamingContent]);

  const createNewConversation = async (mode: AiAssistantMode = selectedMode) => {
    const conv: ChatConversation = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: 'New Conversation',
      mode,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setActiveId(conv.id);
    setError(null);
    await onSaveChat(conv, true);
    return conv;
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const sendMessage = async (overrideMessages?: ChatMessage[], targetConv?: ChatConversation) => {
    if (sendingRef.current || streaming) return;
    const trimmed = input.trim();
    if (!overrideMessages && !trimmed) return;

    sendingRef.current = true;
    setError(null);

    let conv = targetConv || activeChat;
    let isNewConv = false;
    if (!conv) {
      conv = {
        id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: 'New Conversation',
        mode: selectedMode,
        messages: [],
        updatedAt: new Date().toISOString(),
      };
      isNewConv = true;
      setActiveId(conv.id);
    }

    const baseMessages = overrideMessages || conv.messages;
    const nextMessages: ChatMessage[] = overrideMessages
      ? baseMessages
      : [
          ...baseMessages,
          {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: trimmed,
            timestamp: new Date().toISOString(),
          },
        ];

    const derivedTitle =
      conv.title === 'New Conversation' && nextMessages[0]
        ? nextMessages[0].content.slice(0, 42) + (nextMessages[0].content.length > 42 ? '...' : '')
        : conv.title;

    const updatedConv: ChatConversation = {
      ...conv,
      title: derivedTitle,
      mode: selectedMode,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    };

    if (!overrideMessages) setInput('');
    setStreaming(true);
    setStreamingContent('');

    const controller = new AbortController();
    abortRef.current = controller;

    let partialResponse = '';
    let resolvedModel: string = settings.ai.model;

    try {
      // Save user turn immediately to Firestore
      await onSaveChat(updatedConv, isNewConv);

      const customModeObj =
        selectedMode === 'Custom Mode'
          ? customModes.find((m) => m.id === selectedCustomModeId) || customModes[0] || null
          : null;

      const res = await streamAssistantChat(
        {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          mode: selectedMode,
          customMode: customModeObj,
          targetLanguage:
            selectedMode === 'Translator' ? getLanguageById(translatorLangId).name : undefined,
          model: settings.ai.model,
          customInstructions: settings.ai.customInstructions,
          vocabulary,
        },
        (_delta, fullText) => {
          partialResponse = fullText;
          setStreamingContent(fullText);
        },
        controller.signal
      );

      resolvedModel = res.model;
      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: res.text,
        timestamp: new Date().toISOString(),
        model: resolvedModel,
      };

      const completedConv: ChatConversation = {
        ...updatedConv,
        messages: [...nextMessages, assistantMsg],
        updatedAt: new Date().toISOString(),
      };

      await onSaveChat(completedConv, false);
      onLogActivity({
        type: 'ai_request',
        words: countWords(res.text),
        durationSec: 0,
        aiMode: selectedMode,
      });
    } catch (err) {
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      if (isAbort && partialResponse.trim()) {
        // Persist partial streamed answer cleanly when stopped by user
        const partialMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: partialResponse.trim(),
          timestamp: new Date().toISOString(),
          model: resolvedModel,
        };
        await onSaveChat(
          {
            ...updatedConv,
            messages: [...nextMessages, partialMsg],
            updatedAt: new Date().toISOString(),
          },
          false
        ).catch(() => {});
      } else if (!isAbort) {
        setError(err instanceof Error ? err.message : 'Unable to get AI response.');
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
      sendingRef.current = false;
    }
  };

  const handleRegenerate = () => {
    if (!activeChat || activeChat.messages.length === 0 || streaming) return;
    const msgs = [...activeChat.messages];
    if (msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop();
    }
    if (msgs.length === 0) return;
    sendMessage(msgs, activeChat);
  };

  const handleClearConversation = async () => {
    if (!activeChat || streaming) return;
    await onSaveChat(
      {
        ...activeChat,
        title: 'New Conversation',
        messages: [],
        updatedAt: new Date().toISOString(),
      },
      false
    );
    setError(null);
  };

  const handleDeleteChat = async (id: string) => {
    await onDeleteChat(id);
    if (activeId === id) {
      const remaining = chats.filter((c) => c.id !== id);
      setActiveId(remaining[0]?.id || null);
    }
  };

  const handleCopyMessage = async (id: string, content: string) => {
    await navigator.clipboard?.writeText(content);
    setCopiedMsgId(id);
    window.setTimeout(() => setCopiedMsgId(null), 1800);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">AI Assistant</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time streaming Gemini chat with voice input, Markdown rendering, and cloud conversation sync.
          </p>
        </div>

        <button
          type="button"
          onClick={() => createNewConversation(selectedMode)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Conversation
        </button>
      </div>

      {/* 9 AI Modes Bar */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0E0F17]/90 p-2 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {AI_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSelectedMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedMode === mode
                  ? 'bg-violet-600/30 text-white border border-violet-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {selectedMode === 'Translator' && (
          <div className="flex items-center gap-2 px-1 pt-1 border-t border-white/[0.06] text-xs">
            <span className="text-slate-400">Target translation language:</span>
            <select
              value={translatorLangId}
              onChange={(e) => setTranslatorLangId(e.target.value)}
              className="rounded-lg border border-white/[0.09] bg-[#0B0C13] px-2.5 py-1 text-xs text-white focus:border-violet-500/50 focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.nativeName})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedMode === 'Custom Mode' && (
          <div className="flex items-center gap-2 px-1 pt-1 border-t border-white/[0.06] text-xs">
            <span className="text-slate-400">Active preset:</span>
            <select
              value={selectedCustomModeId}
              onChange={(e) => setSelectedCustomModeId(e.target.value)}
              className="rounded-lg border border-white/[0.09] bg-[#0B0C13] px-2.5 py-1 text-xs text-white focus:border-violet-500/50 focus:outline-none"
            >
              {customModes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.tone}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[540px]">
        {/* Chat History List */}
        <div className="lg:col-span-3 rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 p-3 flex flex-col">
          <p className="px-2 py-1.5 text-xs font-medium text-slate-400">Conversation History</p>
          <div className="mt-1 space-y-1 flex-1 overflow-y-auto max-h-[450px]">
            {chats.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-slate-500">
                No conversations yet. Start typing or tap the mic to ask VOXIFY.
              </p>
            ) : (
              chats.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                    c.id === activeChat?.id
                      ? 'bg-violet-600/20 text-white border border-violet-500/30'
                      : 'text-slate-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className="flex-1 text-left truncate"
                  >
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="block text-[11px] text-slate-500">{c.mode}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChat(c.id)}
                    aria-label="Delete conversation"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          {hasMoreChats && (
            <button
              type="button"
              onClick={onLoadMoreChats}
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 text-[11px] text-slate-300 hover:text-white"
            >
              Load Older Conversations
            </button>
          )}
        </div>

        {/* Active Conversation Thread */}
        <div className="lg:col-span-9 rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {activeChat ? activeChat.title : 'Start a Conversation'}
              </p>
              <p className="text-[11px] text-slate-400">
                Mode: {selectedMode} · Model: {settings.ai.model}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {streaming && (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/25 whitespace-nowrap"
                >
                  <Square className="h-3 w-3" />
                  Stop Generation
                </button>
              )}
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={!activeChat || activeChat.messages.length === 0 || streaming}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] disabled:opacity-40 whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleClearConversation}
                disabled={!activeChat || activeChat.messages.length === 0 || streaming}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] disabled:opacity-40 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[430px]">
            {(!activeChat || activeChat.messages.length === 0) && !streaming ? (
              <div className="py-12 text-center max-w-md mx-auto space-y-3">
                <p className="font-display text-lg font-medium text-white">
                  Ask VOXIFY Assistant
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Powered by live Gemini streaming across 9 specialized AI modes. Speak with the microphone or enter your prompt below.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {[
                    'Summarize these meeting bullets into action items',
                    'Draft a concise client launch update email',
                    'Write a TypeScript debounce hook with cleanup',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-violet-400/40 hover:text-white transition-colors text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {activeChat?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-violet-600/25 border border-violet-400/30 text-white whitespace-pre-wrap'
                          : 'bg-white/[0.04] border border-white/[0.08] text-slate-200'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <MarkdownMessage content={msg.content} />
                      ) : (
                        msg.content
                      )}
                      {msg.role === 'assistant' && (
                        <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-4 text-[11px] text-slate-500">
                          <span>{msg.model || settings.ai.model}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="h-3 w-3 text-cyan-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {streaming && (
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-2xl px-4 py-3 bg-white/[0.04] border border-cyan-500/25 text-slate-200 space-y-2">
                      {streamingContent ? (
                        <MarkdownMessage content={streamingContent} />
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-cyan-300">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Streaming response...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-white/[0.07] bg-black/25">
            {voiceInput.interimText && (
              <p className="mb-2 text-xs text-cyan-300">Listening: {voiceInput.interimText}</p>
            )}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() =>
                  voiceInput.state === 'Listening' ? voiceInput.stop() : voiceInput.start()
                }
                aria-label="Voice input"
                className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
                  voiceInput.state === 'Listening'
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                    : 'border-white/[0.09] bg-white/[0.04] text-slate-300 hover:text-white hover:border-violet-400/40'
                }`}
              >
                {voiceInput.state === 'Listening' ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message or click the mic to speak... (Enter to send)"
                className="flex-1 resize-none rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
