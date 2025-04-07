"use client"

import type React from "react"

import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { parseGraphData, exportToPlantUML } from "@/lib/graph-parser"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExampleData } from "@/components/example-data"
import { GraphView } from "@/components/graph-view"
import { useToast } from "@/hooks/use-toast"
import { useMobile } from "@/hooks/use-mobile"
import { Download, Upload, ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Copy } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Node {
  id: string
  name?: string
  properties?: Record<string, any>
  color?: string
  [key: string]: any
}

interface Link {
  source: string
  target: string
  type?: string
  color?: string
  [key: string]: any
}

interface GraphData {
  nodes: Node[]
  links: Link[]
}

export default function GraphVisualizer() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [nodeConnections, setNodeConnections] = useState("")
  const [nodeProperties, setNodeProperties] = useState("")
  const [activeTab, setActiveTab] = useState("input")
  const [error, setError] = useState<string | null>(null)
  const [nodeSizingMode, setNodeSizingMode] = useState<"uniform" | "incoming" | "outgoing" | "provided" | "property">(
    "uniform",
  )
  const [nodeSizingProperty, setNodeSizingProperty] = useState<string>("")
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [zoom, setZoom] = useState(1)
  const [plantUMLText, setPlantUMLText] = useState("")
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const isMobile = useMobile()
  const [fixedNode, setFixedNode] = useState<Node | null>(null)
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set())
  const [availableProperties, setAvailableProperties] = useState<string[]>([])
  const [colorScaleCache, setColorScaleCache] = useState<Record<string, string>>({})
  const [groupColorMap, setGroupColorMap] = useState<Record<string, string>>({})

  // Initialize color scale cache with default colors
  useEffect(() => {
    const defaultColors = [
      "#4285F4", // Google Blue
      "#EA4335", // Google Red
      "#FBBC05", // Google Yellow
      "#34A853", // Google Green
      "#8E24AA", // Purple
      "#00ACC1", // Cyan
      "#FB8C00", // Orange
      "#607D8B", // Blue Grey
      "#E91E63", // Pink
      "#9E9E9E", // Grey
    ]

    // Extract all groups from the graph data
    const groups = new Set<string>()
    graphData.nodes.forEach((node) => {
      if (node.properties?.group) {
        groups.add(node.properties.group)
      } else {
        groups.add("default")
      }
    })

    // Sort groups to ensure consistent color assignment
    const sortedGroups = Array.from(groups).sort()

    // Create initial color scale
    const initialColorScale: Record<string, string> = {}
    sortedGroups.forEach((group, index) => {
      initialColorScale[group] = defaultColors[index % defaultColors.length]
    })

    // Update color scale cache
    setColorScaleCache((prev) => {
      const newCache = { ...prev }
      // Only add new groups, don't override existing colors
      sortedGroups.forEach((group) => {
        if (!newCache[group]) {
          newCache[group] = initialColorScale[group]
        }
      })
      return newCache
    })
  }, [graphData.nodes])

  // Initialize and maintain stable group colors
  useEffect(() => {
    const defaultColors = [
      "#4285F4", // Google Blue
      "#EA4335", // Google Red
      "#FBBC05", // Google Yellow
      "#34A853", // Google Green
      "#8E24AA", // Purple
      "#00ACC1", // Cyan
      "#FB8C00", // Orange
      "#607D8B", // Blue Grey
      "#E91E63", // Pink
      "#9E9E9E", // Grey
    ]

    // Get all groups from the graph data
    const groups = new Set<string>()
    graphData.nodes.forEach((node) => {
      if (node.properties?.group) {
        groups.add(node.properties.group)
      } else {
        groups.add("default")
      }
    })

    // Sort groups for consistent assignment
    const sortedGroups = Array.from(groups).sort()

    // Update the color map, preserving existing color assignments
    setGroupColorMap((prev) => {
      const newColorMap = { ...prev }

      // Assign colors to new groups
      sortedGroups.forEach((group, index) => {
        if (!newColorMap[group]) {
          newColorMap[group] = defaultColors[index % defaultColors.length]
        }
      })

      return newColorMap
    })
  }, [graphData.nodes])

  const handleGenerateGraph = useCallback(() => {
    try {
      const data = parseGraphData(nodeConnections, nodeProperties)

      if (data.nodes.length === 0) {
        toast({
          title: "No nodes found",
          description: "Please check your input format and try again",
          variant: "destructive",
        })
        return
      }

      // Extract available numeric properties for node sizing
      const numericProperties = new Set<string>()
      data.nodes.forEach((node) => {
        if (node.properties) {
          Object.entries(node.properties).forEach(([key, value]) => {
            if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)))) {
              numericProperties.add(key)
            }
          })
        }
      })
      setAvailableProperties(Array.from(numericProperties))

      setGraphData(data)
      setError(null)
      setPlantUMLText(exportToPlantUML(data))
      setHiddenGroups(new Set()) // Reset hidden groups when generating a new graph

      // Switch to visualization tab after generating the graph
      setActiveTab("visualization")

      toast({
        title: "Graph generated",
        description: `Created graph with ${data.nodes.length} nodes and ${data.links.length} links`,
      })
    } catch (error) {
      console.error("Error generating graph:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
      toast({
        title: "Error parsing graph data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }, [nodeConnections, nodeProperties, toast])

  const handleExampleDataApply = useCallback(
    (connections: string, properties: string) => {
      setNodeConnections(connections)
      setNodeProperties(properties)

      // Generate the graph immediately when example data is loaded
      try {
        const data = parseGraphData(connections, properties)

        // Extract available numeric properties for node sizing
        const numericProperties = new Set<string>()
        data.nodes.forEach((node) => {
          if (node.properties) {
            Object.entries(node.properties).forEach(([key, value]) => {
              if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)))) {
                numericProperties.add(key)
              }
            })
          }
        })
        setAvailableProperties(Array.from(numericProperties))

        setGraphData(data)
        setPlantUMLText(exportToPlantUML(data))
        setError(null)
        setHiddenGroups(new Set()) // Reset hidden groups when loading example data
        setActiveTab("visualization")

        toast({
          title: "Example data loaded",
          description: `Created graph with ${data.nodes.length} nodes and ${data.links.length} links`,
        })
      } catch (error) {
        console.error("Error generating graph from example:", error)
        setError(error instanceof Error ? error.message : "Unknown error")
      }
    },
    [toast],
  )

  // Update the handleGraphUpdate function to preserve color information
  const handleGraphUpdate = useCallback(
    (updatedNodes: any[], updatedEdges: any[]) => {
      // Convert nodes format to match our internal format
      const nodes = updatedNodes.map((node) => ({
        id: node.id,
        name: node.label,
        properties: node.properties,
        color: node.color,
        x: node.x,
        y: node.y,
      }))

      // Convert edges format to match our internal format
      const links = updatedEdges.map((edge) => ({
        source: edge.from,
        target: edge.to,
        color: edge.color,
      }))

      // Create a map of existing links to preserve their colors
      const existingLinkMap = new Map<string, Link>()
      graphData.links.forEach((link) => {
        const sourceId = typeof link.source === "object" ? link.source.id : link.source
        const targetId = typeof link.target === "object" ? link.target.id : link.target
        const key = `${sourceId}->${targetId}`
        existingLinkMap.set(key, link)
      })

      // Update all nodes in the graph data, including hidden ones
      const updatedGraphData = {
        nodes: graphData.nodes.map((existingNode) => {
          // Find if this node was updated
          const updatedNode = nodes.find((n) => n.id === existingNode.id)
          if (updatedNode) {
            // Node was visible and updated, use new position
            return {
              ...existingNode,
              color: updatedNode.color,
              x: updatedNode.x,
              y: updatedNode.y,
            }
          }
          // Node wasn't in the visible set, keep its existing data
          return existingNode
        }),
        links: links.map((link) => {
          // Check if this link existed before and had a color
          const key = `${link.source}->${link.target}`
          const existingLink = existingLinkMap.get(key)

          // If the link existed and had a color, preserve it
          if (existingLink && existingLink.color && !link.color) {
            return {
              ...link,
              color: existingLink.color,
            }
          }

          return link
        }),
      }

      setGraphData(updatedGraphData)
      setPlantUMLText(exportToPlantUML(updatedGraphData))
    },
    [graphData],
  )

  // Handle node deletion
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      // Remove the node from the graph data
      const updatedNodes = graphData.nodes.filter((node) => node.id !== nodeId)

      // Remove edges connected to this node
      const updatedLinks = graphData.links.filter((link) => {
        const sourceId = typeof link.source === "object" ? link.source.id : link.source
        const targetId = typeof link.target === "object" ? link.target.id : link.target
        return sourceId !== nodeId && targetId !== nodeId
      })

      // Update graph data
      const updatedGraphData = {
        nodes: updatedNodes,
        links: updatedLinks,
      }

      setGraphData(updatedGraphData)
      setPlantUMLText(exportToPlantUML(updatedGraphData))

      // If the deleted node was the fixed node, clear it
      if (fixedNode && fixedNode.id === nodeId) {
        setFixedNode(null)
      }

      // If the deleted node was the hovered node, clear it
      if (hoveredNode && hoveredNode.id === nodeId) {
        setHoveredNode(null)
      }
    },
    [graphData, fixedNode, hoveredNode],
  )

  // Handle node hover
  const handleNodeHover = useCallback((node: Node | null) => {
    setHoveredNode(node)
  }, [])

  // Handle zoom change
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  // Copy PlantUML text
  const handleCopyPlantUML = useCallback(() => {
    navigator.clipboard.writeText(plantUMLText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    toast({
      title: "PlantUML copied",
      description: "PlantUML text has been copied to clipboard",
    })
  }, [plantUMLText, toast])

  // Export graph state
  const handleExportGraph = useCallback(() => {
    if (!graphData.nodes.length) return

    try {
      // Create graph state object
      const graphState = {
        nodes: graphData.nodes,
        links: graphData.links,
        version: "1.0",
      }

      // Convert to JSON
      const jsonString = JSON.stringify(graphState, null, 2)

      // Create download link
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "graph-state.json"
      document.body.appendChild(a)
      a.click()

      // Clean up
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Graph exported",
        description: "Graph data has been exported as JSON",
      })
    } catch (error) {
      console.error("Error exporting graph:", error)
      toast({
        title: "Export failed",
        description: "Failed to export graph data",
        variant: "destructive",
      })
    }
  }, [graphData, toast])

  // Import graph state
  const handleImportGraph = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const graphState = JSON.parse(content)

          // Validate data
          if (
            !graphState.nodes ||
            !Array.isArray(graphState.nodes) ||
            !graphState.links ||
            !Array.isArray(graphState.links)
          ) {
            toast({
              title: "Invalid graph file format",
              description: "The file does not contain valid graph data",
              variant: "destructive",
            })
            return
          }

          // Extract available numeric properties for node sizing
          const numericProperties = new Set<string>()
          graphState.nodes.forEach((node) => {
            if (node.properties) {
              Object.entries(node.properties).forEach(([key, value]) => {
                if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)))) {
                  numericProperties.add(key)
                }
              })
            }
          })
          setAvailableProperties(Array.from(numericProperties))

          // Update graph data
          setGraphData(graphState)
          setPlantUMLText(exportToPlantUML(graphState))
          setHiddenGroups(new Set()) // Reset hidden groups when importing a graph
          setActiveTab("visualization")

          toast({
            title: "Graph imported",
            description: `Imported graph with ${graphState.nodes.length} nodes and ${graphState.links.length} links`,
          })
        } catch (error) {
          console.error("Error importing graph:", error)
          toast({
            title: "Failed to import graph",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          })
        }
      }

      reader.readAsText(file)

      // Reset file input
      if (event.target) {
        event.target.value = ""
      }
    },
    [toast],
  )

  // Trigger file input click
  const handleImportClick = useCallback(() => {
    // Create a temporary file input if the ref isn't available
    if (!fileInputRef.current) {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".json"
      input.onchange = (e) => handleImportGraph(e as React.ChangeEvent<HTMLInputElement>)
      input.click()
    } else {
      fileInputRef.current.click()
    }
  }, [handleImportGraph])

  // Extract all unique groups from the graph data
  const allGroups = useMemo(() => {
    const groups = new Set<string>()
    graphData.nodes.forEach((node) => {
      if (node.properties?.group) {
        groups.add(node.properties.group)
      } else {
        groups.add("default")
      }
    })
    return Array.from(groups).sort()
  }, [graphData.nodes])

  // Toggle group visibility
  const toggleGroupVisibility = useCallback((group: string) => {
    setHiddenGroups((prev) => {
      const newHiddenGroups = new Set(prev)
      if (newHiddenGroups.has(group)) {
        newHiddenGroups.delete(group)
      } else {
        newHiddenGroups.add(group)
      }
      return newHiddenGroups
    })
  }, [])

  // Show all groups
  const showAllGroups = useCallback(() => {
    setHiddenGroups(new Set())
  }, [])

  // Hide all groups
  const hideAllGroups = useCallback(() => {
    setHiddenGroups(new Set(allGroups))
  }, [allGroups])

  // Filter nodes based on hidden groups
  const visibleNodes = useMemo(() => {
    return graphData.nodes
      .filter((node) => {
        const group = node.properties?.group || "default"
        return !hiddenGroups.has(group)
      })
      .map((node) => {
        // Preserve the node's color when filtering
        const group = node.properties?.group || "default"
        return {
          ...node,
          // Keep the original color if it exists, otherwise use the stable group color
          color: node.color || groupColorMap[group] || "#888",
        }
      })
  }, [graphData.nodes, hiddenGroups, groupColorMap])

  // Store all node positions, even for hidden nodes
  const allNodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    graphData.nodes.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        positions[node.id] = { x: node.x, y: node.y }
      }
    })
    return positions
  }, [graphData.nodes])

  // Filter edges based on visible nodes
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
    return graphData.links.filter((link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source
      const targetId = typeof link.target === "object" ? link.target.id : link.target
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)
    })
  }, [visibleNodes, graphData.links])

  // Convert our graph data to GraphView format
  const simpleNodes = visibleNodes.map((node) => ({
    id: node.id,
    label: node.name || node.id,
    properties: node.properties,
    color: node.color,
    x: node.x,
    y: node.y,
  }))

  const simpleEdges = visibleEdges.map((link) => ({
    from: typeof link.source === "object" ? link.source.id : link.source,
    to: typeof link.target === "object" ? link.target.id : link.target,
    color: link.color,
  }))

  // Add handler for fixing node info
  const handleFixNodeInfo = useCallback((node: Node) => {
    setFixedNode(node)
  }, [])

  // Add colorScale for the fixed node display
  const colorScale = useMemo(() => {
    return groupColorMap
  }, [groupColorMap])

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
        <div className="flex justify-between items-center p-4 border-b">
          <h1 className="text-2xl font-bold">Graph Visualizer</h1>
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
                placeholder={`Enter node properties in JSON format, including optional "group" and numeric properties for sizing`}
                className="h-64 font-mono"
                value={nodeProperties}
                onChange={(e) => setNodeProperties(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Format: {'{ "nodeId": { "name": "Node Name", "group": "GroupName", "value": 10 } }'}
              </p>
            </div>
          </div>

          <ExampleData onApply={handleExampleDataApply} />

          <div className="mt-6 flex gap-4">
            <Button onClick={handleGenerateGraph}>Generate Graph</Button>
            <Button variant="outline" onClick={handleImportClick}>
              Import Graph
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportGraph}
              style={{ display: "none" }}
            />
          </div>
        </TabsContent>

        <TabsContent value="visualization" className="flex-1 overflow-hidden h-[calc(100vh-120px)]">
          {error ? (
            <Card className="w-full">
              <CardContent className="pt-6">
                <p className="text-center text-destructive">Error: {error}</p>
              </CardContent>
            </Card>
          ) : graphData.nodes.length > 0 ? (
            <div className="flex h-full">
              {/* Main Graph Area - Fixed size to fill available space */}
              <div className="flex-1 overflow-hidden">
                <GraphView
                  nodes={simpleNodes}
                  edges={simpleEdges}
                  onGraphUpdate={handleGraphUpdate}
                  onNodeHover={!fixedNode ? handleNodeHover : undefined}
                  onZoomChange={handleZoomChange}
                  nodeSizingMode={nodeSizingMode}
                  nodeSizingProperty={nodeSizingProperty}
                  onFixNodeInfo={handleFixNodeInfo}
                  onDeleteNode={handleDeleteNode}
                  fixedNode={fixedNode}
                />
              </div>

              {/* Right Sidebar - Fixed width */}
              <div className="w-96 border-l border-gray-200 overflow-hidden flex flex-col">
                <Tabs defaultValue="info" className="w-full h-full flex flex-col">
                  <div className="p-4 border-b shrink-0">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="info">Info</TabsTrigger>
                      <TabsTrigger value="groups">Groups</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                      <TabsTrigger value="export">Export</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Node Information Tab - Scrollable content */}
                  <TabsContent value="info" className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-medium">Node Information</h3>
                      {fixedNode && (
                        <Button variant="outline" size="sm" onClick={() => setFixedNode(null)}>
                          Release Fixed Node
                        </Button>
                      )}
                    </div>
                    <div className="p-4 overflow-auto flex-1">
                      {fixedNode || hoveredNode ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{
                                backgroundColor:
                                  (fixedNode || hoveredNode).color ||
                                  ((fixedNode || hoveredNode).properties?.group
                                    ? colorScale[(fixedNode || hoveredNode).properties.group]
                                    : "#888"),
                              }}
                            />
                            <span className="font-medium">
                              {(fixedNode || hoveredNode).label || (fixedNode || hoveredNode).id}
                            </span>
                            {fixedNode && <span className="text-xs text-muted-foreground">(Fixed)</span>}
                          </div>
                          <div className="text-sm text-muted-foreground">ID: {(fixedNode || hoveredNode).id}</div>
                          {(fixedNode || hoveredNode).properties && (
                            <div className="mt-2">
                              <div className="text-sm font-medium">Properties:</div>
                              <div className="bg-muted p-2 rounded-md text-xs overflow-auto mt-1">
                                <pre>{JSON.stringify((fixedNode || hoveredNode).properties, null, 2)}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Hover over a node to see its details, or right-click a node and select "Fix Node Info" to
                            keep its information displayed.
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Groups Tab */}
                  <TabsContent value="groups" className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-medium">Group Visibility</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={showAllGroups} className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>Show All</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={hideAllGroups} className="flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          <span>Hide All</span>
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 overflow-auto flex-1">
                      {allGroups.length > 0 ? (
                        <div className="space-y-4">
                          {allGroups.map((group) => {
                            const isVisible = !hiddenGroups.has(group)
                            const groupNodes = graphData.nodes.filter(
                              (node) => (node.properties?.group || "default") === group,
                            )

                            return (
                              <div key={group} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{
                                      backgroundColor: colorScale[group],
                                      opacity: isVisible ? 1 : 0.3,
                                    }}
                                  />
                                  <span className={`${isVisible ? "font-medium" : "text-muted-foreground"}`}>
                                    {group}
                                  </span>
                                  <span className="text-xs text-muted-foreground">({groupNodes.length} nodes)</span>
                                </div>
                                <Switch checked={isVisible} onCheckedChange={() => toggleGroupVisibility(group)} />
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No groups found in the current graph.</p>
                      )}
                    </div>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="p-4 overflow-auto">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium mb-2">Graph Settings</h3>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Node Sizing</h4>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="sizing-mode"
                              checked={nodeSizingMode === "uniform"}
                              onChange={() => setNodeSizingMode("uniform")}
                              className="h-4 w-4 text-primary"
                            />
                            <span className="text-sm">Uniform Size</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="sizing-mode"
                              checked={nodeSizingMode === "incoming"}
                              onChange={() => setNodeSizingMode("incoming")}
                              className="h-4 w-4 text-primary"
                            />
                            <span className="text-sm">Size by Incoming Connections</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="sizing-mode"
                              checked={nodeSizingMode === "outgoing"}
                              onChange={() => setNodeSizingMode("outgoing")}
                              className="h-4 w-4 text-primary"
                            />
                            <span className="text-sm">Size by Outgoing Connections</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="sizing-mode"
                              checked={nodeSizingMode === "provided"}
                              onChange={() => setNodeSizingMode("provided")}
                              className="h-4 w-4 text-primary"
                            />
                            <span className="text-sm">Size from Input (use "size" property)</span>
                          </label>
                          <div className="flex flex-col gap-2 pl-6">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="sizing-mode"
                                checked={nodeSizingMode === "property"}
                                onChange={() => setNodeSizingMode("property")}
                                className="h-4 w-4 text-primary"
                              />
                              <span className="text-sm">Size by Property:</span>
                            </label>

                            {availableProperties.length > 0 ? (
                              <Select
                                value={nodeSizingProperty}
                                onValueChange={setNodeSizingProperty}
                                disabled={nodeSizingMode !== "property"}
                              >
                                <SelectTrigger className="w-[180px] ml-6">
                                  <SelectValue placeholder="Select property" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableProperties.map((prop) => (
                                    <SelectItem key={prop} value={prop}>
                                      {prop}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-xs text-muted-foreground ml-6">
                                No numeric properties available in the current graph
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Zoom Controls</h4>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground mr-2">Zoom: {Math.round(zoom * 100)}%</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.dispatchEvent(new CustomEvent("graph-zoom-out"))}
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.dispatchEvent(new CustomEvent("graph-reset-zoom"))}
                          >
                            <Maximize className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.dispatchEvent(new CustomEvent("graph-zoom-in"))}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Export Tab */}
                  <TabsContent value="export" className="p-4 overflow-auto">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium mb-2">Export Options</h3>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Save/Load Graph</h4>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={handleExportGraph}>
                            <Download className="h-4 w-4 mr-2" />
                            Export Graph as JSON
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleImportClick}>
                            <Upload className="h-4 w-4 mr-2" />
                            Import Graph from JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.dispatchEvent(new CustomEvent("graph-export-png"))}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Save as PNG
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-medium">PlantUML</h4>
                          <Button size="sm" onClick={handleCopyPlantUML} className="flex items-center gap-1">
                            <Copy className="h-4 w-4" />
                            <span>{copied ? "Copied!" : "Copy PlantUML"}</span>
                          </Button>
                        </div>
                        <div className="bg-muted p-2 rounded-md text-xs overflow-auto max-h-[calc(100vh-400px)]">
                          <pre>{plantUMLText}</pre>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : (
            <Card className="w-full">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No graph data available. Go to the Input tab to create a graph.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

