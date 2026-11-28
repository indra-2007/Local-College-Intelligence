import type { CSSProperties } from "react";

const paths = {
  chat: "M4 4.75h16v11.5H9l-5 4v-15.5Zm4 4h8m-8 3.5h5",
  archive: "M3.5 4.5h17v4h-17zM5 8.5v11h14v-11M10 12h4",
  route: "M4 5h5l6 7h5M4 19h5l6-7m2-3 3 3-3 3",
  table: "M3.5 4.5h17v15h-17zM3.5 10h17M9 10v9.5",
  book: "M12 6.2C9 4.5 6 4.2 3 4.7v13.5c3-.5 6-.2 9 1.5 3-1.7 6-2 9-1.5V4.7c-3-.5-6-.2-9 1.5zm0 .3v13",
  page: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  upload: "M4 15v4.5h16V15M12 15V4m-4.5 4.5L12 4l4.5 4.5",
  send: "M3.5 4.2 21 12 3.5 19.8l2.7-7.8-2.7-7.8Zm2.9 7.8H16",
  plus: "M12 5v14M5 12h14",
  stop: "M6.5 6.5h11v11h-11z",
  refresh: "M19.5 6.8v4.4h-4.4m4.1-.9a7.3 7.3 0 1 0-.7 6.2",
  exit: "M10 4H5v16h5M10 12h11m-4-4 4 4-4 4",
  chevron: "m6.5 9.5 5.5 5.5 5.5-5.5",
  close: "m6 6 12 12M18 6 6 18",
  trash: "M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 10v7m4-7v7",
  check: "m4.5 12 5 5 10-11",
  chip: "M6.5 6.5h11v11h-11zm3 3h5v5h-5zM9 3v3m6-3v3m-6 12v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3",
  clock: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-4.5V12l3 2",
  copy: "M8 8h12v13H8zM5 16H3V3h12v2",
  edit: "m5 16-.6 4 4-.7L19 8.5 15.5 5 5 16Zm9-9.5 3.5 3.5",
  sidebar: "M4 5.5h16v13H4zM9.5 5.5v13",
} as const;

export type IconName = keyof typeof paths;

export default function Icon({ name, size = 19, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={paths[name]} />
  </svg>;
}
