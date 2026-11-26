import type { CSSProperties } from "react";
import styles from "./title-letters.module.css";

// The enclosing heading supplies the whole accessible name.
export default function TitleLetters({ text }: { text: string }) {
  return <span aria-hidden="true" className={styles.letters}>
    {text.split(" ").map((word, index) => <span key={index}>{index > 0 && " "}
      <span className={styles.word}>{Array.from(word, (letter, i) =>
        <span key={i} className={styles.glyph} data-dash={letter === "-" || undefined}
          style={{ "--delay": `${Math.min(i + index, 6) * 22}ms` } as CSSProperties}>{letter}</span>
      )}</span></span>)}
  </span>;
}
