import { useEffect, useRef, useState } from "react";
import { getMetrics, getSegments, postStep, postReset } from "../api/client";

export function useSimulation() {
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [segments, setSegments] = useState(null);
  const runningRef = useRef(false);

  const refresh = async () => {
    const [m, s] = await Promise.all([getMetrics(), getSegments()]);
    setMetrics(m); setSegments(s);
  };

  useEffect(() => {
    runningRef.current = running;
    if (!running) return;
    let cancelled = false;
    (async function tick() {
      while (!cancelled && runningRef.current) {
        await postStep(200);
        await refresh();
        await new Promise(r => setTimeout(r, 400));
      }
    })();
    return () => { cancelled = true; };
  }, [running]);

  const reset = async () => {
    setRunning(false);
    await postReset();
    await refresh();
  };

  useEffect(() => { refresh().catch(() => {}); }, []);
  return { running, setRunning, reset, metrics, segments };
}
