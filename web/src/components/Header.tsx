"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/workspace-client";
import Icon from "./workspace/Icon";
import styles from "./workspace/workspace.module.css";

type GpuStats = {
  available: boolean; gpu_name?: string; gpu_util_pct?: number;
  mem_used_mb?: number; mem_total_mb?: number; temperature_c?: number;
};

const number = (value: number | undefined, unit: string) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString()} ${unit}` : "—";

export default function Header() {
  const [gpu, setGpu] = useState<GpuStats | null>(null);

  useEffect(() => {
    let timer: number;
    let active: AbortController;
    async function sample() {
      if (document.hidden) return;
      const request = new AbortController();
      active = request;
      try {
        const data = await readJson<GpuStats>("/api/gpu", { signal: request.signal });
        if (!request.signal.aborted) setGpu(data?.available === true ? data : { available: false });
      } catch {
        if (!request.signal.aborted) setGpu({ available: false });
      } finally {
        if (!request.signal.aborted) timer = window.setTimeout(sample, 5000);
      }
    }
    function stop() { window.clearTimeout(timer); active?.abort(); }
    function visibility() { stop(); void sample(); }
    void sample();
    document.addEventListener("visibilitychange", visibility);
    return () => { stop(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  const active = gpu?.available === true;
  const load = active && Number.isFinite(gpu.gpu_util_pct) ? gpu.gpu_util_pct : undefined;
  return <header className={styles.railHead}>
    <Link className={styles.brand} href="/ai-assistant" aria-label="C-GPT, AI chat">
      <span className={styles.door} aria-hidden="true"><i /></span>
      <span><strong>C-GPT</strong><small>Local College Intelligence</small></span>
    </Link>
    <details className={styles.telemetry}>
      <summary><Icon name="chip" size={15} /><span>GPU {load !== undefined ? `${load}%` : active ? "ready" : gpu ? "N/A" : "…"}</span>
        <Icon name="chevron" size={12} /></summary>
      <div className={styles.readings}>
        {active ? <><strong>{gpu.gpu_name || "Local GPU"}</strong>
          {load !== undefined && <meter min={0} max={100} value={load} aria-label="GPU utilization" />}
          <dl><dt>Utilization</dt><dd>{number(load, "%")}</dd>
            <dt>Memory used</dt><dd>{number(gpu.mem_used_mb, "MB")}</dd>
            <dt>Total memory</dt><dd>{number(gpu.mem_total_mb, "MB")}</dd>
            <dt>Temperature</dt><dd>{number(gpu.temperature_c, "°C")}</dd></dl></>
          : <p>{gpu ? "GPU readings are unavailable." : "Checking GPU readings…"}</p>}
      </div>
    </details>
  </header>;
}
