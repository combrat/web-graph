"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { parseGraphData } from "@/lib/graph-parser"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExampleData } from "@/components/example-data"
import { ExportDialog } from "@/components/export-dialog"
import { useToast } from "@/hooks/use-toast"
import { useMobile } from "@/hooks/use-mobile"

interface Node {
  id: string
  name?: string
  properties?: Record<string, any>
  [key: string]: any
}

interface Link {
  source: string
  target: string
  type?: string
  [key: string]: any
}

interface GraphData {
  nodes: Node[]
  links: Link[]
}

export default function GraphVisualizer3D() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [nodeConnections, setNodeConnections] = useState("")
  const [nodeProperties, setNodeProperties] = useState("")
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const graphRef = useRef<any>(null)
  const { toast } = useToast()
  const isMobile = useMobile()

  // Dynamically import ForceGraph3D to avoid A-Frame initialization issues
  useEffect(() => {
    let isMounted = true

    const loadForceGraph = async () => {
      try {
        // Dynamically import the ForceGraph component
        const ForceGraphModule = await import("react-force-graph")

        // Only update state if component is still mounted
        if (isMounted) {
          setForceGraph(() => ForceGraphModule.ForceGraph3D)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Failed to load ForceGraph:", error)
        if (isMounted) {
          toast({
            title: "Error loading 3D graph visualization",
            description: "Please try refreshing the page",
            variant: "destructive",
          })
        }
      }
    }

    loadForceGraph()

    return () => {
      isMounted = false
    }
  }, [toast])

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node)
    setIsDialogOpen(true)
  }, [])

  const handleGenerateGraph = useCallback(() => {
    try {
      const data = parseGraphData(nodeConnections, nodeProperties)
      setGraphData(data)
      toast({
        title: "Graph generated",
        description: `Created 3D graph with ${data.nodes.length} nodes and ${data.links.length} links`,
      })
    } catch (error) {
      toast({
        title: "Error parsing graph data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }, [nodeConnections, nodeProperties, toast])

  const handleZoomToFit = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 40)
    }
  }, [])

  const handleExampleDataApply = useCallback((connections: string, properties: string) => {
    setNodeConnections(connections)
    setNodeProperties(properties)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="input" className="w-full">
        <div className="flex justify-between items-center p-4 border-b">
          <h1 className="text-2xl font-bold">3D Graph Visualizer</h1>
          <TabsList>
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="visualization">Visualization</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="input" className="p-4 flex-1 overflow-auto">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Node Connections</h2>
              <Textarea
                placeholder={"Enter node connections (e.g., A->B, B->C, A->C)"}
                className="h-64 font-mono"
                value={nodeConnections}
                onChange={(e) => setNodeConnections(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Format: {"node1->node2, node3->node4, etc."}</p>
            </div>
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Node Properties</h2>
              <Textarea
                placeholder="Enter node properties in JSON format"
                className="h-64 font-mono"
                value={nodeProperties}
                onChange={(e) => setNodeProperties(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Format: {'{ "nodeId": { "property": "value" } }'}</p>
            </div>
          </div>

          <ExampleData onApply={handleExampleDataApply} />

          <div className="mt-6 flex gap-4">
            <Button onClick={handleGenerateGraph}>Generate 3D Graph</Button>
            <Button variant="outline" onClick={handleZoomToFit}>
              Zoom to Fit
            </Button>
            <ExportDialog graphData={graphData} />
          </div>
        </TabsContent>

        <TabsContent value="visualization" className="flex-1 relative">
          <div className="absolute inset-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Card className="w-96">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">Loading 3D graph visualization...</p>
                  </CardContent>
                </Card>
              </div>
            ) : graphData.nodes.length > 0 && ForceGraph ? (
              <ForceGraph
                ref={graphRef}
                graphData={graphData}
                nodeLabel={(node) => node.name || node.id}
                nodeColor={(node) => {
                  if (node.properties?.type === "source") return "#4caf50"
                  if (node.properties?.type === "process") return "#2196f3"
                  if (node.properties?.type === "decision") return "#ff9800"
                  if (node.properties?.type === "sink") return "#f44336"
                  return "#1e88e5"
                }}
                linkColor={() => "#999"}
                onNodeClick={handleNodeClick}
                width={isMobile ? window.innerWidth : window.innerWidth - 40}
                height={isMobile ? window.innerHeight - 120 : window.innerHeight - 120}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Card className="w-96">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      No graph data available. Go to the Input tab to create a graph.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNode?.name || selectedNode?.id}</DialogTitle>
            <DialogDescription>Node properties and details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">ID</h3>
              <p className="text-sm">{selectedNode?.id}</p>
            </div>
            {selectedNode?.properties && (
              <div>
                <h3 className="font-medium">Properties</h3>
                <pre className="bg-muted p-2 rounded-md text-sm overflow-auto max-h-60">
                  {JSON.stringify(selectedNode.properties, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

