"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, RotateCcw, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { portfolio } from "@/data/portfolio";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content: portfolio.assistant.welcome,
};

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);

  const chooseSuggestion = (label: string, reply: string) => {
    setMessages((current) => [
      ...current,
      { id: "user-" + current.length, role: "user", content: label },
      { id: "assistant-" + current.length, role: "assistant", content: reply },
    ]);
  };

  const close = () => {
    setOpen(false);
    setMinimized(false);
  };

  return (
    <div className="assistant-root">
      <AnimatePresence>
        {!open ? (
          <motion.button
            type="button"
            className="assistant-fab"
            aria-label="Open assistant"
            onClick={() => setOpen(true)}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
          >
            <span className="assistant-orbit" aria-hidden="true" />
            <Image src="/avatar.jpg" alt="" width={43} height={43} priority />
            <span className="assistant-status" aria-hidden="true" />
            <span className="assistant-tip" aria-hidden="true"><strong>&gt;</strong> Open assistant<small>local replies only</small></span>
          </motion.button>
        ) : (
          <motion.section
            className={minimized ? "assistant-panel is-minimized" : "assistant-panel"}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-title"
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
          >
            <header>
              <div className="assistant-avatar"><Image src="/avatar.jpg" alt="" width={38} height={38} /><span aria-hidden="true" /></div>
              <div>
                <h2 id="assistant-title"><span>&gt;</span> huy.ai</h2>
                <p>{"// online locally"}</p>
              </div>
              <div className="assistant-controls">
                <button
                  type="button"
                  aria-label="Reset assistant"
                  onClick={() => setMessages([welcomeMessage])}
                >
                  <RotateCcw aria-hidden="true" size={14} />
                </button>
                <button
                  type="button"
                  aria-label={minimized ? "Restore assistant" : "Minimize assistant"}
                  onClick={() => setMinimized((current) => !current)}
                >
                  {minimized ? <Sparkles aria-hidden="true" size={14} /> : <Minus aria-hidden="true" size={14} />}
                </button>
                <button type="button" aria-label="Close assistant" onClick={close}>
                  <X aria-hidden="true" size={15} />
                </button>
              </div>
            </header>
            {!minimized ? (
              <>
                <div className="assistant-notice">Local demo — no data leaves this browser</div>
                <div className="assistant-messages" aria-live="polite">
                  {messages.map((message) => (
                    <div className={"assistant-message is-" + message.role} key={message.id}>
                      {message.role === "assistant" ? <span className="message-prompt">&gt;</span> : null}
                      <p>{message.content}</p>
                    </div>
                  ))}
                </div>
                <div className="assistant-suggestions">
                  {portfolio.assistant.suggestions.map((suggestion) => (
                    <button
                      type="button"
                      onClick={() => chooseSuggestion(suggestion.label, suggestion.reply)}
                      key={suggestion.label}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
                <footer><Sparkles aria-hidden="true" size={13} /> Scripted local responses</footer>
              </>
            ) : null}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
