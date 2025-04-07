import GraphVisualizer from "@/components/graph-visualizer"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-col w-full h-screen">
        <GraphVisualizer />
      </div>
    </main>
  )
}

