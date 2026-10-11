import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { ask, classifyPlant } from "./api";
import usePersistentState from './persistentStorage.js'

// crypto.randomUUID() needs a secure context, and a phone reaching the laptop
// over http://<local-ip> is not one, so use a simple id generator instead.
const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const newChat = () => ({
  id: makeId(),
  title: "New chat",
  messages: [],
  plantCandidates: [],
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches the 10 MB limit in main.py
const DEFAULT_IMAGE_QUESTION = "What might this plant be, and is it safe to touch or eat?";

// Shrink the photo to a small JPEG data URL for the chat history. Storing the
// full photo (or a blob: URL, which dies on reload) in persistent storage
// would either bloat it or break.
const makeThumbnail = (file, maxSize = 240) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

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
    sidebar: "border-stone-100 bg-stone-100",
    closeBtn: "border-stone-400 bg-stone-200 text-green-900 hover:bg-stone-300",
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
    attachBtn: "bg-stone-200 text-green-800 hover:bg-green-800 hover:text-white",
    thumbBorder: "border-stone-300",
    removeBtn: "border-stone-400 bg-white text-green-900 hover:bg-stone-200",
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
    sidebar: "border-green-950 bg-green-950",
    closeBtn: "border-green-700 bg-green-900 text-green-300 hover:bg-green-800",
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
    attachBtn: "bg-stone-700 text-green-400 hover:bg-green-500 hover:text-stone-800",
    thumbBorder: "border-stone-600",
    removeBtn: "border-stone-600 bg-stone-700 text-green-300 hover:bg-stone-600",
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

function UserMessage({ content, image }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-green-800 px-4 py-2.5 text-green-50 shadow-sm md:max-w-[70%]">
        {image && (
          <img
            src={image}
            alt="Uploaded plant"
            className="mb-2 max-h-48 rounded-lg object-cover"
          />
        )}
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
          <p className={`animate-pulse py-2 ${t.muted}`}>
            {message.stage === "scanning" ? "Scanning image..." : "Thinking..."}
          </p>
        )}

        {status === "error" && (
          <p className={`rounded-xl border px-4 py-2.5 ${t.error}`}>{content}</p>
        )}

        {status === "done" && (
          <>
            {meta?.candidates?.length > 0 && (
              <div className={`mb-2 rounded-xl border px-3 py-2 text-sm ${t.divider} ${t.muted}`}>
                <p className="font-medium">Possible matches (unverified)</p>
                <ul className="mt-1 space-y-0.5">
                  {meta.candidates.map((c, i) => (
                    <li key={i}>
                      {c.species} ({(c.score * 100).toFixed(0)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={t.text}>
              <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
            </div>

            {meta?.sources?.length > 0 && (
              <div className={`mt-2 border-t pt-2 text-xs ${t.divider} ${t.muted}`}>
                <p>
                  Sources:{" "}
                  {meta.sources.map((s) => `${s.source}, page ${s.page}`).join("; ")}
                </p>
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
  const [chats, setChats] = usePersistentState(
      "chats",
      () => [newChat()]
  );

  const [activeId, setActiveId] = usePersistentState(
      "active-chat",
      null
  );
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null); // { file, previewUrl } waiting to be sent
  const [attachError, setAttachError] = useState("");
  const [loadingIds, setLoadingIds] = useState([]); // chats with a request in flight
  const [theme, setTheme] = useState("dark"); // app starts in dark mode
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 768
  );

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const isDark = theme === "dark";
  const t = THEMES[theme];

  // Default to the first chat until the user picks one.
  const current = chats.find((c) => c.id === activeId) ?? chats[0];
  const isEmpty = current.messages.length === 0;
  const isLoading = loadingIds.includes(current.id);
  const sendDisabled = (!input.trim() && !image) || isLoading;
  // Only chats with at least one message appear in the history list.
  const savedChats = chats.filter((c) => c.messages.length > 0);

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

  // Release the preview's blob URL when it is replaced or the app unmounts.
  useEffect(() => {
    return () => {
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    };
  }, [image]);

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
    clearImage();
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSelectChat = (id) => {
    setActiveId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // ----- Image attachment -----

  const clearImage = () => {
    setImage(null);
    setAttachError("");
    // Reset the input so choosing the same file again still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAttachError("Please choose an image file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAttachError("That image is over 10 MB. Choose a smaller one.");
      e.target.value = "";
      return;
    }

    setAttachError("");
    setImage({ file, previewUrl: URL.createObjectURL(file) });
  };

  const handleSubmit = async () => {
    const typed = input.trim();
    if ((!typed && !image) || isLoading) return;

    const question = typed || DEFAULT_IMAGE_QUESTION;
    const file = image?.file ?? null;
    const chatId = current.id;
    const assistantId = makeId();
    const existingCandidates = current.plantCandidates ?? [];

    const thumb = file ? await makeThumbnail(file) : null;

    updateChat(chatId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? question.slice(0, 40) : c.title,
      messages: [
        ...c.messages,
        { id: makeId(), role: "user", content: typed, image: thumb },
        {
          id: assistantId,
          role: "assistant",
          status: "pending",
          stage: file ? "scanning" : "thinking",
          content: "",
        },
      ],
    }));
    setInput("");
    clearImage();
    setLoadingIds((ids) => [...ids, chatId]);

    const finish = (patch) =>
      updateChat(chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
      }));

    try {
      // 1. If a photo was attached, get the top candidate species first.
      let candidates = existingCandidates;
      let newCandidates = null;

      if (file) {
        let scan;
        try {
          scan = await classifyPlant(file);
        } catch (err) {
          finish({
            status: "error",
            content: `Could not scan the image. ${err.message || ""}`.trim(),
          });
          return;
        }
        newCandidates = scan.predictions ?? [];
        candidates = newCandidates;
        updateChat(chatId, (c) => ({ ...c, plantCandidates: newCandidates }));
        finish({ stage: "thinking" });
      }

      // 2. Ask Llama, passing the (unverified) candidates along.
      const data = await ask(question, candidates);
      finish({
        status: "done",
        content: data.answer,
        meta: {
          reference_status: data.reference_status,
          used_references: data.used_references,
          sources: data.sources ?? [],
          candidates: newCandidates ?? [],
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
        className={`fixed inset-y-0 left-0 z-30 flex w-1/2 flex-col md:w-72 border-r transition-all duration-300 md:static ${t.sidebar} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
        }`}
      >
        <div className="flex items-center justify-between gap-1 px-2 py-4 md:px-4">
          <span className={`min-w-0 truncate text-sm font-semibold tracking-tight md:text-lg ${t.brand}`}>CampBuddy</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`flex shrink-0 items-center justify-center rounded-md border p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 md:hidden ${t.closeBtn}`}
            aria-label="Close history"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-2 md:px-3">
          <button
            onClick={handleNewChat}
            className={`group inline-flex items-center gap-2 rounded-lg border border-green-700 px-2 py-2 text-sm font-medium md:px-3 transition-colors hover:bg-green-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${t.brand}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-green-700 transition-colors group-hover:text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>
        </div>

        {savedChats.length > 0 && (
          <nav
            className={`mx-2 mt-4 flex-1 overflow-y-auto md:mx-3 border-t pb-4 pt-4 ${t.divider}`}
            aria-labelledby="chat-history-heading"
          >
            <h2 id="chat-history-heading" className={`px-2 pb-2 text-xs font-medium md:px-3 ${t.brand}`}>
              Chat history
            </h2>
            <ul className="space-y-1">
              {savedChats.map((chat) => (
                <li key={chat.id}>
                  <button
                    onClick={() => handleSelectChat(chat.id)}
                    className={`w-full truncate rounded-lg px-2 py-2 text-left text-sm md:px-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
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
        )}
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
                <UserMessage key={m.id} content={m.content} image={m.image} />
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
              {/* Attached image preview, with an x at its top right corner */}
              {image && (
                <div className="px-4 pt-4">
                  <div className="relative inline-block">
                    <img
                      src={image.previewUrl}
                      alt="Image to send"
                      className={`h-20 w-20 rounded-lg border object-cover ${t.thumbBorder}`}
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      aria-label="Remove image"
                      className={`absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${t.removeBtn}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={image ? "Ask about this plant (optional)" : "Ask CampBuddy a question"}
                className={`block w-full resize-none rounded-2xl bg-transparent px-4 pb-14 pt-4 focus:outline-none ${t.input}`}
              />

              {/* Hidden file picker; on phones this offers camera or gallery */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Image button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach an image"
                className={`absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${t.attachBtn}`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </button>

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

            {attachError && (
              <p className={`mt-2 text-center text-xs ${isDark ? "text-red-300" : "text-red-700"}`} role="alert">
                {attachError}
              </p>
            )}
            <p className={`mt-2 text-center text-xs ${t.muted}`}>
              CampBuddy can be wrong. Don't rely on it for emergencies or for deciding what is safe to eat or drink.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
