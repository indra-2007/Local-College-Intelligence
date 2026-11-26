"use client";

import TitleLetters from "@/components/TitleLetters";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon, { type IconName } from "@/components/workspace/Icon";
import shared from "@/components/workspace/workspace.module.css";
import { modeLabels, type Mode } from "@/lib/conversations";
import { chatArtwork } from "@/lib/chat-artwork";
import { readJson, type Tables } from "@/lib/workspace-client";
import Transcript from "./Transcript";
import { placeReadingLight } from "@/components/workspace/reading-light";
import { useConversation } from "./useConversation";
import styles from "./chat.module.css";

type ModeInfo = { room: string; icon: IconName; line: string; emphasis: string; help: string; placeholder: string; examples: string[] };
const modes: Record<Mode, ModeInfo> = {
  chat: { room: "The listening room", icon: "chat", line: "What would you", emphasis: "like to know?", help: "Pull up a chair and ask the local AI a question.",
    placeholder: "Write a message to C-GPT…", examples: ["Explain binary search with an example.", "Help me plan a study session.", "Quiz me on stacks and queues.", "Turn my lecture notes into revision questions."] },
  data: { room: "Campus records", icon: "table", line: "What’s in", emphasis: "the records?", help: "Ask in plain English. Inspect the SQL and the rows it returns.",
    placeholder: "Ask a question about the campus tables…", examples: ["Count students by department.", "Show the first five rows of the attendance table.", "Which semester has the most students?", "Show the distinct course codes."] },
  docs: { room: "Document archive", icon: "book", line: "Find it in", emphasis: "the archive.", help: "Search college documents and trace the answer to its source.",
    placeholder: "Ask about a regulation, circular, or syllabus…", examples: ["What are the attendance requirements?", "How does course registration work?", "Find the rule for making up a missed exam.", "Which circular mentions credit requirements?"] },
  ask: { room: "Reference desk", icon: "route", line: "What do the", emphasis: "sources say?",
    help: "Ask a campus question. C-GPT can consult tables, documents, or both.",
    placeholder: "Ask about campus records, policies, or both…",
    examples: ["Which attendance records fall below the policy threshold?", "What does the handbook say about course registration?", "Compare recorded course credits with the syllabus.", "How many students are enrolled in each semester?"] },
};
const emptyDrafts: Record<Mode, string> = { chat: "", data: "", docs: "", ask: "" };

function PromptChoices({ examples, onSelect }: { examples: string[]; onSelect: (text: string) => void }) {
  const [offset, setOffset] = useState(0);
  return <div className={styles.suggestions}>
    <header><h3>Try a question</h3>
      <button type="button" className={styles.morePrompts} onClick={() => setOffset(n => (n + 2) % examples.length)}>
        <Icon name="refresh" size={14} />More prompts
      </button>
    </header>
    <div className={styles.promptList} aria-live="polite" aria-atomic="true">
      {examples.slice(offset, offset + 2).map(prompt => <button key={prompt} type="button" onClick={() => onSelect(prompt)}>
        <Icon name="edit" size={16} /><span>{prompt}</span>
      </button>)}
    </div>
  </div>;
}

const audienceLabels: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  hod: "HOD",
  admin: "Admin",
};

export default function ChatDesk({
  role,
  userId,
  audiences,
  initialMode,
}: {
  role: string;
  userId: string;
  audiences: string[];
  initialMode?: Mode;
}) {
  const [audience, setAudience] = useState(role);
  const conversation = useConversation(audience, userId, initialMode);
  const { mode, thread, busy, restored } = conversation;
  const info = modes[mode];
  const [drafts, setDrafts] = useState(emptyDrafts);
  const draft = drafts[mode];
  function setDraft(text: string) {
    setDrafts(previous => ({ ...previous, [mode]: text }));
  }
  const [models, setModels] = useState<string[]>([]);
  const [choice, setChoice] = useState("");
  const [modelState, setModelState] = useState<"loading" | "ready" | "offline" | "empty">("loading");
  const [attempt, setAttempt] = useState(0);
  const [tableCount, setTableCount] = useState<number | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const model = models.includes(choice) ? choice : models[0] ?? "";

  useEffect(() => {
    const controller = new AbortController();
    readJson<{ models: { name: string }[] }>("/api/models", { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        const found = (data.models ?? []).map(m => m.name).filter(Boolean);
        setModels(found); setModelState(found.length ? "ready" : "empty");
      }).catch(() => { if (!controller.signal.aborted) { setModels([]); setModelState("offline"); } });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    readJson<{ tables: Tables }>("/api/tables", { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setTableCount(Object.keys(data.tables ?? {}).length);
    }).catch(() => { if (!controller.signal.aborted) setTableCount(null); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (pane.current && follow.current) pane.current.scrollTop = pane.current.scrollHeight;
  }, [thread?.messages]);

  const canSend = restored && !busy && !!draft.trim() && (mode !== "chat" || !!model);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    const text = draft;
    setDraft(""); follow.current = true;
    void conversation.send(text, model);
  }

  function selectExample(value: string) {
    setDraft(value);
    composer.current?.focus();
  }

  return <section className={`${shared.page} ${styles.desk}`} data-mode={mode} aria-labelledby="chat-heading">
    <header className={shared.pageHead}><h1 id="chat-heading" aria-label="AI chat"><TitleLetters text="AI chat" /></h1>
      <button type="button" className={shared.ghost} disabled={busy || !thread} onClick={() => {
        conversation.newThread(); setDrafts(emptyDrafts); follow.current = true; composer.current?.focus();
      }}><Icon name="plus" size={16} />New chat</button>
    </header>
    <div className={styles.tools}>
      <div className={styles.modes} role="group" aria-label="Chat mode">{(Object.keys(modes) as Mode[]).map(key =>
        <button key={key} type="button" aria-pressed={key === mode} disabled={busy} onClick={() => conversation.setMode(key)}>
          <Icon name={modes[key].icon} size={17} />{modeLabels[key]}
          {key === "data" && tableCount !== null && tableCount > 0 &&
            <small className={styles.tableCount} aria-label={`${tableCount} tables`}>{tableCount > 99 ? "99+" : tableCount}</small>}
        </button>)}</div>
      <div className={styles.model} aria-live="polite">
        <Icon name="chip" size={16} />
        {modelState === "ready" ? <label className={styles.select}><span className={shared.srOnly}>Local model</span>
          <select value={model} disabled={busy} onChange={e => setChoice(e.target.value)}>{models.map(name => <option key={name}>{name}</option>)}</select>
          <Icon name="chevron" size={13} /></label> : <>
          <span>{modelState === "loading" ? "Connecting…" : modelState === "empty" ? "No model installed" : "Model offline"}</span>
          {modelState !== "loading" && <button type="button" className={styles.retry} aria-label="Reconnect to the local model" title="Reconnect"
            onClick={() => { setModelState("loading"); setAttempt(n => n + 1); }}><Icon name="refresh" size={15} /></button>}
        </>}
      </div>
    </div>

    <div className={styles.reader} ref={pane} onScroll={e => {
      const p = e.currentTarget; follow.current = p.scrollHeight - p.scrollTop - p.clientHeight < 70;
    }}>
      {!thread?.messages.length ? <div className={styles.empty}>
        <div className={`${styles.hero} ${shared.litSurface}`} onPointerMove={placeReadingLight}>
          <div className={styles.photographs} aria-hidden="true">
            {Object.entries(chatArtwork).map(([key, image]) => (
              <Image key={key} src={image} alt="" fill unoptimized sizes="(max-width: 800px) 100vw, 80vw"
                loading={key === mode ? "eager" : "lazy"} fetchPriority={key === mode ? "high" : "low"}
                className={styles.photograph} data-active={key === mode || undefined} />
            ))}
          </div>
          <div key={mode} className={styles.heroText}>
            <div className={styles.roomLabel}><i aria-hidden="true" />{info.room}</div>
            <h2 aria-label={`${info.line} ${info.emphasis}`}><TitleLetters text={info.line} />{" "}<em><TitleLetters text={info.emphasis} /></em></h2>
            <p>{info.help}</p>
          </div>
        </div>
        <PromptChoices key={mode} examples={info.examples} onSelect={selectExample} />
      </div> : <Transcript messages={thread.messages} busy={busy} />}
    </div>

    <div className={styles.writeArea}>
      {conversation.saveError && <p role="status" className={shared.hint}>This conversation could not be saved in this browser.</p>}
      {mode === "data" && tableCount === 0 && <p className={styles.context}>No tables available. <Link href="/upload">Upload a dataset</Link> to use Ask SQL.</p>}
      {mode === "data" && tableCount !== null && tableCount > 0 &&
        <p className={styles.context}>{tableCount.toLocaleString()} {tableCount === 1 ? "table" : "tables"} available</p>}
      {(mode === "docs" || mode === "ask") && <label className={styles.audience}>
        Demo audience
        <select value={audience} disabled={busy} onChange={e => setAudience(e.target.value)}>
          {audiences.map(a => <option key={a} value={a}>{audienceLabels[a] ?? a}</option>)}
        </select>
      </label>}
      <form className={styles.composer} onSubmit={submit}>
        <textarea id="question" ref={composer} rows={2} value={draft} placeholder={info.placeholder}
          onChange={e => setDraft(e.target.value)} onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault(); if (!busy) e.currentTarget.form?.requestSubmit();
            }
          }} />
        <div className={styles.composerFoot}>
          <label className={styles.composerMode} htmlFor="question">
            <Icon name={info.icon} size={14} /><span className={shared.srOnly}>Your question for </span>{modeLabels[mode]}
          </label>
          <span className={styles.keyboardHint}>Enter to send <b>·</b> Shift + Enter for a new line</span>
          {busy ? <button type="button" className={shared.ghost} onClick={conversation.stop}><Icon name="stop" size={15} />Stop</button>
            : <button type="submit" className={shared.primary} disabled={!canSend}><Icon name="send" size={16} />Send</button>}
        </div>
      </form>
    </div>
    <span className={shared.srOnly} role="status">{busy ? "Waiting for a reply." : thread ? "Response complete." : ""}</span>
  </section>;
}
