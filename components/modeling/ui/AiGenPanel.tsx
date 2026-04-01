"use client";

import { useState, useCallback } from "react";
import { createNodesFromGeometry } from "@/lib/modeling/actions/sceneActions";
import { modelSceneStore } from "@/lib/modeling/store/useModelSceneStore";

interface AiGenPanelProps {
  onClose: () => void;
}

const PRESETS = [
  { label: "Golf club head", prompt: "a golf club head, titanium, realistic", type: "box" as const, dims: { width: 0.05, height: 0.12, depth: 0.08 }, color: "#c0c0c0" },
  { label: "Golf ball", prompt: "a golf ball with dimples", type: "sphere" as const, dims: { radius: 0.02135 }, color: "#ffffff" },
  { label: "Driver head", prompt: "a large driver head, 460cc, aerodynamic", type: "box" as const, dims: { width: 0.12, height: 0.08, depth: 0.1 }, color: "#1a1a2e" },
  { label: "Iron club", prompt: "an iron club face, thin topline", type: "cylinder" as const, dims: { radiusTop: 0.03, radiusBottom: 0.03, height: 0.2 }, color: "#888888" },
];

function parseDimensionsFromPrompt(prompt: string): { type: "box" | "sphere" | "cylinder"; dims: Record<string, number>; color: string } {
  const p = prompt.toLowerCase();
  if (p.includes("ball") || p.includes("sphere") || p.includes("round")) {
    return { type: "sphere", dims: { radius: 0.05 }, color: "#ffffff" };
  }
  if (p.includes("cylinder") || p.includes("shaft") || p.includes("rod")) {
    return { type: "cylinder", dims: { radiusTop: 0.02, radiusBottom: 0.02, height: 0.3 }, color: "#c0c0c0" };
  }
  return { type: "box", dims: { width: 0.1, height: 0.1, depth: 0.05 }, color: "#6ea8ff" };
}

export function AiGenPanel({ onClose }: AiGenPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let params: ReturnType<typeof parseDimensionsFromPrompt> | null = null;

      // Try Ollama for parameter extraction
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama3.2",
            prompt: `You are a 3D geometry parameter generator. Given a description, respond ONLY with a JSON object: {"type": "box"|"sphere"|"cylinder", "width": number, "height": number, "depth": number, "radius": number, "radiusTop": number, "radiusBottom": number, "height": number, "color": "#hex"}. Default dimensions in meters. Object: ${prompt}`,
            stream: false,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as { response?: string };
          const text = data.response ?? "";
          const match = text.match(/\{[^}]+\}/);
          if (match) {
            const parsed = JSON.parse(match[0]) as Record<string, unknown>;
            const type = String(parsed.type ?? "box") as "box" | "sphere" | "cylinder";
            const color = String(parsed.color ?? "#6ea8ff");
            if (type === "sphere") {
              params = { type, dims: { radius: Number(parsed.radius) || 0.05 }, color };
            } else if (type === "cylinder") {
              params = { type, dims: { radiusTop: Number(parsed.radiusTop) || 0.03, radiusBottom: Number(parsed.radiusBottom) || 0.03, height: Number(parsed.height) || 0.2 }, color };
            } else {
              params = { type, dims: { width: Number(parsed.width) || 0.1, height: Number(parsed.height) || 0.1, depth: Number(parsed.depth) || 0.1 }, color };
            }
          }
        }
      } catch {
        // Ollama not available — fall through to local parsing
      }

      if (!params) {
        params = parseDimensionsFromPrompt(prompt);
      }

      const nodes = createNodesFromGeometry({
        type: params.type,
        name: prompt.slice(0, 32),
        parentId: null,
        position: [0, 0, 0],
        dimensions: params.dims,
        color: params.color,
      });

      const s = modelSceneStore.getState();
      const newNodes = { ...s.scene.nodes };
      const newRootIds = [...s.scene.rootNodeIds];
      for (const node of nodes) {
        newNodes[node.id] = node;
        newRootIds.push(node.id);
      }
      modelSceneStore.applyScene({ ...s.scene, nodes: newNodes, rootNodeIds: newRootIds, updatedAt: Date.now() }, "ai_generate");

      setResult(`Created ${params.type}: ${JSON.stringify(params.dims)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="cave-panel w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-alfredWhite">✨ AI Generate Geometry</h2>
          <button className="text-xs text-slate-400 hover:text-alfredWhite" onClick={onClose}>✕</button>
        </div>

        <p className="mb-3 text-xs text-slate-400">
          Describe an object. Ollama extracts geometry params; local defaults if unavailable.
        </p>

        {/* Golf presets */}
        <div className="mb-3 flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className="rounded border border-caveBorder px-2 py-0.5 text-xs text-slate-300 hover:border-alfredWhite/40"
              onClick={() => setPrompt(preset.prompt)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <textarea
          className="mb-3 w-full rounded border border-caveBorder bg-batcave px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-alfredWhite/50 focus:outline-none"
          rows={3}
          placeholder="a golf club head, titanium, realistic..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
        />

        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        {result && <p className="mb-2 text-xs text-green-400">{result}</p>}

        <div className="flex gap-2">
          <button
            className="flex-1 rounded border border-alfredWhite/30 bg-alfredWhite/10 px-3 py-1.5 text-xs text-alfredWhite hover:bg-alfredWhite/20 disabled:opacity-50"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
          <button className="rounded border border-caveBorder px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
