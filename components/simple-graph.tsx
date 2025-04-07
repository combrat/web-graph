"use client"

import { useEffect, useRef, useState } from "react"

interface SimpleGraphProps {
  nodes: Array<{ id: string; label: string }>
  edges: Array<{ from: string; to: string }>
}

export function SimpleGraph({ nodes, edges }: SimpleGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Make sure we have nodes and edges to display
    if (nodes.length === 0) return

    // Make sure the container is available
    if (!containerRef.current) {
      console.error("Container ref is null")
      setError("Container element not found")
      return
    }

    // Wait for the DOM to be fully rendered
    const timer = setTimeout(() => {
      initGraph()
    }, 100)

    return () => {
      clearTimeout(timer)
    }
  }, [nodes, edges])

  const initGraph = async () => {
    // Double check that the container is still available
    if (!containerRef.current) {
      console.error("Container ref is null during initialization")
      setError("Container element not found during initialization")
      return
    }

    // Make sure the container has dimensions
    const { width, height } = containerRef.current.getBoundingClientRect()
    if (width === 0 || height === 0) {
      console.error("Container has zero dimensions:", width, height)
      setError("Container has zero dimensions")
      return
    }

    console.log("Initializing graph with container:", containerRef.current)
    console.log("Container dimensions:", width, height)

    try {
      // Dynamically import vis-network
      const visNetwork = await import("vis-network")
      const visData = await import("vis-data")

      // Create datasets
      const nodesDataset = new visData.DataSet(nodes)
      const edgesDataset = new visData.DataSet(edges.map((edge, i) => ({ id: i, ...edge, arrows: "to" })))

      // Create network
      const options = {
        nodes: {
          shape: "dot",
          size: 16,
          font: { size: 12 },
          borderWidth: 2,
          shadow: true,
        },
        edges: {
          width: 1,
          shadow: true,
        },
        physics: {
          stabilization: true,
        },
      }

      // Create the network
      const network = new visNetwork.Network(
        containerRef.current,
        {
          nodes: nodesDataset,
          edges: edgesDataset,
        },
        options,
      )

      // Fit the network
      network.once("stabilizationIterationsDone", () => {
        network.fit()
      })

      setError(null)
    } catch (error) {
      console.error("Failed to initialize simple graph:", error)
      setError(error instanceof Error ? error.message : "Failed to initialize graph")
    }
  }

  return (
    <div className="flex flex-col items-center w-full">
      {error ? <div className="p-4 bg-red-50 text-red-500 rounded-md w-full">Error: {error}</div> : null}

      <div
        ref={containerRef}
        className="w-full h-[500px] border border-gray-300 rounded-md"
        style={{ background: "#f8f9fa" }}
      />

      <p className="text-sm text-muted-foreground mt-2">
        {nodes.length} nodes and {edges.length} edges
      </p>
    </div>
  )
}

