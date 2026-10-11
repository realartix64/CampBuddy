import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { ask } from "./api";

// crypto.randomUUID() needs a secure context, and a phone reaching the laptop
// over http://<local-ip> is not one, so use a simple id generator instead.
const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const newChat = () => ({ id: makeId(), title: "New chat", messages: [] });

// ---------- Theme presets ----------
// Every theme-dependent Tailwind class lives here as a full literal string, so
// switching themes swaps the classes in JS and does not depend on Tailwind's
// `dark:` variant configuration. The send button is part of the presets;
// the "New chat" button, user bubble and active chat item are intentionally not.

const THEMES = {
  light: {
    root: "bg-white text-green-950",
    text: "text-green-950",
    muted: "text-green-700",
    brand: "text-green-900",
    sidebar: "border-stone-300 bg-stone-100",
    closeBtn: "text-green-700 hover:bg-stone-200",
    menuBtn: "text-green-800 hover:bg-stone-200",
    chatItemIdle: "text-green-950 hover:bg-stone-200",
    fade: "from-white via-white/90 to-transparent",
    bar: "border-stone-400 bg-white",
    input: "text-green-950 placeholder-stone-500",
    divider: "border-stone-300",
    error: "border-red-300 bg-red-50 text-red-900",
    toggleBox: "border-stone-400 bg-white",
    toggleHighlight: "bg-green-800",
    toggleSun: "text-white",
    toggleMoon: "text-stone-500",
    sendOn: "bg-green-800 text-white hover:bg-green-900",
    sendOff: "bg-stone-300 text-stone-600",
    sendFocus: "focus-visible:ring-green-600 focus-visible:ring-offset-white",
    mdStrong: "text-green-950",
    mdLink: "text-green-700 hover:text-green-900",
    mdQuote: "border-green-600 text-green-800",
    mdCode: "bg-stone-200 text-green-900",
  },
  dark: {
    root: "bg-stone-900 text-green-400",
    text: "text-green-50",
    muted: "text-green-500",
    brand: "text-green-400",
    sidebar: "border-green-800 bg-green-950",
    closeBtn: "text-green-500 hover:bg-green-900",
    menuBtn: "text-green-400 hover:bg-stone-800",
    chatItemIdle: "text-green-400 hover:bg-green-900",
    fade: "from-stone-900 via-stone-900/90 to-transparent",
    bar: "border-stone-700 bg-stone-800",
    input: "text-green-400 placeholder-green-400/70",
    divider: "border-stone-700",
    error: "border-red-900 bg-red-950 text-red-300",
    toggleBox: "border-stone-700 bg-stone-800",
    toggleHighlight: "bg-stone-600",
    toggleSun: "text-stone-500",
    toggleMoon: "text-green-300",
    sendOn: "bg-green-500 text-green-950 hover:bg-green-400",
    sendOff: "bg-stone-700 text-stone-400",
    sendFocus: "focus-visible:ring-green-400 focus-visible:ring-offset-stone-800",
    mdStrong: "text-green-300",
    mdLink: "text-green-300 hover:text-green-200",
    mdQuote: "border-green-700 text-green-500",
    mdCode: "bg-stone-700 text-green-300",
  },
};

// ---------- Markdown rendering (Tailwind classes per element) ----------

const buildMdComponents = (t) => ({
  p: (props) => <p className="my-2 leading-relaxed" {...props} />,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-6" {...props} />,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-6" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  h1: (props) => <h1 className="mb-1 mt-4 text-xl font-semibold" {...props} />,
  h2: (props) => <h2 className="mb-1 mt-4 text-lg font-semibold" {...props} />,
  h3: (props) => <h3 className="mb-1 mt-3 text-base font-semibold" {...props} />,
  strong: (props) => <strong className={`font-semibold ${t.mdStrong}`} {...props} />,
  a: (props) => (
    <a
      className={`underline ${t.mdLink}`}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote className={`my-2 border-l-4 pl-3 ${t.mdQuote}`} {...props} />
  ),
  pre: (props) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg bg-stone-800 p-3 text-sm text-stone-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-stone-100"
      {...props}
    />
  ),
  code: (props) => (
    <code className={`rounded px-1 py-0.5 text-[0.9em] ${t.mdCode}`} {...props} />
  ),
});

// ---------- Small pieces ----------

function ThemeToggle({ isDark, onToggle, t }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={onToggle}
      className={`relative flex h-9 w-20 items-center rounded-xl border p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${t.toggleBox}`}
    >
      {/* Sliding highlight rectangle */}
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-lg transition-all duration-300 ease-out ${t.toggleHighlight} ${
          isDark ? "translate-x-full" : "translate-x-0"
        }`}
      />

      {/* Sun */}
      <span
        className={`relative z-10 flex flex-1 items-center justify-center transition-colors duration-300 ${t.toggleSun}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </span>

      {/* Moon */}
      <span
        className={`relative z-10 flex flex-1 items-center justify-center transition-colors duration-300 ${t.toggleMoon}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    </button>
  );
}

function UserMessage({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-green-800 px-4 py-2.5 text-green-50 shadow-sm md:max-w-[70%]">
        {content}
      </div>
    </div>
  );
}

function AssistantMessage({ message, t }) {
  const { status, content, meta } = message;
  const mdComponents = useMemo(() => buildMdComponents(t), [t]);

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] md:max-w-[80%]">
        {status === "pending" && (
          <p className={`animate-pulse py-2 ${t.muted}`}>Thinking...</p>
        )}

        {status === "error" && (
          <p className={`rounded-xl border px-4 py-2.5 ${t.error}`}>{content}</p>
        )}

        {status === "done" && (
          <>
            <div className={t.text}>
              <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
            </div>

            {meta && (
              <div className={`mt-2 border-t pt-2 text-xs ${t.divider} ${t.muted}`}>
                <p>{meta.reference_status}</p>
                {meta.sources?.length > 0 && (
                  <p className="mt-0.5">
                    Sources:{" "}
                    {meta.sources.map((s) => `${s.source}, page ${s.page}`).join("; ")}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- App ----------

export default function App() {
  const [chats, setChats] = useState(() => [newChat()]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [loadingIds, setLoadingIds] = useState([]); // chats with a request in flight
  const [theme, setTheme] = useState("dark"); // app starts in dark mode
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 768
  );

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const isDark = theme === "dark";
  const t = THEMES[theme];

  // Default to the first chat until the user picks one.
  const current = chats.find((c) => c.id === activeId) ?? chats[0];
  const isEmpty = current.messages.length === 0;
  const isLoading = loadingIds.includes(current.id);
  const sendDisabled = !input.trim() || isLoading;

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [current.messages]);

  // Auto-grow the textarea up to a limit.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const updateChat = (chatId, updater) =>
    setChats((prev) => prev.map((c) => (c.id === chatId ? updater(c) : c)));

  const handleNewChat = () => {
    // Reuse an existing empty chat instead of stacking blank ones.
    const blank = chats.find((c) => c.messages.length === 0);
    if (blank) {
      setActiveId(blank.id);
    } else {
      const chat = newChat();
      setChats((prev) => [chat, ...prev]);
      setActiveId(chat.id);
    }
    setInput("");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSelectChat = (id) => {
    setActiveId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSubmit = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    const chatId = current.id;
    const assistantId = makeId();

    updateChat(chatId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? question.slice(0, 40) : c.title,
      messages: [
        ...c.messages,
        { id: makeId(), role: "user", content: question },
        { id: assistantId, role: "assistant", status: "pending", content: "" },
      ],
    }));
    setInput("");
    setLoadingIds((ids) => [...ids, chatId]);

    const finish = (patch) =>
      updateChat(chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
      }));

    try {
      const data = await ask(question);
      finish({
        status: "done",
        content: data.answer,
        meta: {
          reference_status: data.reference_status,
          used_references: data.used_references,
          sources: data.sources ?? [],
        },
      });
    } catch (err) {
      finish({
        status: "error",
        content:
          "Could not reach the CampBuddy server. Check that the backend and Ollama are running, then try again.",
      });
    } finally {
      setLoadingIds((ids) => ids.filter((id) => id !== chatId));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`flex h-screen w-full overflow-hidden transition-colors duration-300 ${t.root}`}
    >
      {/* ---------- Sidebar: chat history ---------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r transition-all duration-300 md:static ${t.sidebar} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className={`text-lg font-semibold tracking-tight ${t.brand}`}>CampBuddy</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`rounded-md px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 md:hidden ${t.closeBtn}`}
            aria-label="Close history"
          >
            Close
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={handleNewChat}
            className="w-full rounded-lg border border-green-700 px-3 py-2 text-left text-sm font-medium text-green-800 transition-colors hover:bg-green-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            New chat
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Chat history">
          <ul className="space-y-1">
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  onClick={() => handleSelectChat(chat.id)}
                  className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                    chat.id === current.id
                      ? "bg-green-800 text-green-50"
                      : t.chatItemIdle
                  }`}
                >
                  {chat.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Backdrop for the mobile slide-over */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-stone-900/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ---------- Main chat area ---------- */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className={`rounded-md p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${t.menuBtn}`}
            aria-label="Toggle chat history"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {!sidebarOpen && (
            <span className={`font-semibold tracking-tight ${t.brand}`}>CampBuddy</span>
          )}

          <div className="ml-auto">
            <ThemeToggle
              isDark={isDark}
              t={t}
              onToggle={() => setTheme(isDark ? "light" : "dark")}
            />
          </div>
        </header>

        {/* Conversation: prompts on the right, responses on the left */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="mx-auto max-w-3xl space-y-6 pb-44 pt-4">
            {current.messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} content={m.content} />
              ) : (
                <AssistantMessage key={m.id} message={m} t={t} />
              )
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Empty-state heading, shown above the centered chat bar */}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 px-6 text-center">
            <h1 className={`text-2xl font-semibold md:text-3xl ${t.brand}`}>
              Ask about the trail ahead
            </h1>
            <p className={`mt-2 ${t.muted}`}>
              Gear, first aid, navigation, and camp skills, answered offline.
            </p>
          </div>
        )}

        {/* Floating chat bar: centered when empty, docked to the bottom once chatting */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-5 pt-10 transition-transform duration-500 ease-out ${
            isEmpty ? "-translate-y-[35vh]" : `translate-y-0 bg-gradient-to-t ${t.fade}`
          }`}
        >
          <div className="pointer-events-auto mx-auto max-w-3xl">
            <div
              className={`relative rounded-2xl border shadow-lg focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-600/30 ${t.bar}`}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask CampBuddy a question"
                className={`block w-full resize-none rounded-2xl bg-transparent px-4 pb-14 pt-4 focus:outline-none ${t.input}`}
              />
              <button
                onClick={handleSubmit}
                disabled={sendDisabled}
                aria-label="Send question"
                className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${t.sendFocus} ${
                  sendDisabled ? `cursor-not-allowed ${t.sendOff}` : t.sendOn
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
            <p className={`mt-2 text-center text-xs ${t.muted}`}>
              CampBuddy can be wrong. Don't rely on it for emergencies or for deciding what is safe to eat or drink.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
