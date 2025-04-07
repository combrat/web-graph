"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize, Download } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface Node {
  id: string
  label: string
  x: number
  y: number
  color?: string
  properties?: Record<string, any>
}

interface Edge {
  from: string
  to: string
}

interface SimpleDragGraphProps {
  nodes: Array<{
    id: string
    label: string
    properties?: Record<string, any>
    color?: string
  }>
  edges: Array<{ from: string; to: string }>
  onGraphUpdate?: (nodes: Node[], edges: Edge[]) => void
  onNodeSelect?: (node: Node) => void
  nodeSizingMode: "uniform" | "incoming" | "outgoing" | "provided"
}

interface NodeWithPosition extends Node {
  x: number
  y: number
}

export function SimpleDragGraph({
  nodes: initialNodes,
  edges,
  onGraphUpdate,
  onNodeSelect,
  nodeSizingMode,
}: SimpleDragGraphProps) {
  // Container and SVG refs
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // State for nodes with positions
  const [nodes, setNodes] = useState<Node[]>([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // Dragging state
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const [selectedNode, setSelectedNode] = useState<NodeWithPosition | null>(null)
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false)
  const [nodeColor, setNodeColor] = useState("#000000")
  const [groupColorDialogOpen, setGroupColorDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [groupColor, setGroupColor] = useState("#000000")
  const [customGroupColors, setCustomGroupColors] = useState<Record<string, string>>({})
  const [contextMenuNode, setContextMenuNode] = useState<NodeWithPosition | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<NodeWithPosition | null>(null)

  // Extract unique groups from nodes
  const groups = useMemo(() => {
    const allGroups = nodes.map((node) => node.properties?.group || "default")
    return Array.from(new Set(allGroups))
  }, [nodes])

  // Create a color scale for groups
  const colorScale = useMemo(() => {
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

    // Create a mapping of group to color
    const colorMap: Record<string, string> = {}

    groups.forEach((group, index) => {
      // Use custom color if available, otherwise use default color
      colorMap[group] = customGroupColors[group] || defaultColors[index % defaultColors.length]
    })

    return colorMap
  }, [groups, customGroupColors])

  // Initialize nodes with positions
  useEffect(() => {
    if (!containerRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    // Initialize nodes with positions if they don't have them
    const nodesWithPositions = initialNodes.map((node) => {
      // If we already have this node with a position, keep its position
      const existingNode = nodes.find((n) => n.id === node.id)
      if (existingNode) {
        return {
          ...node,
          x: existingNode.x,
          y: existingNode.y,
        }
      }

      // Otherwise, assign a random position
      return {
        ...node,
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (height - 100) + 50,
      }
    })

    setNodes(nodesWithPositions)
  }, [initialNodes])

  // Handle node drag start
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation()
      e.preventDefault()

      if (!containerRef.current) return

      // Find the node
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      // Calculate offset from mouse to node center
      const containerRect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - containerRect.left
      const mouseY = e.clientY - containerRect.top

      // Adjust for current zoom and pan
      const adjustedX = (mouseX - pan.x) / zoom
      const adjustedY = (mouseY - pan.y) / zoom

      setDragOffset({
        x: node.x - adjustedX,
        y: node.y - adjustedY,
      })

      setDragging(nodeId)
    },
    [nodes, zoom, pan],
  )

  // Handle mouse move for dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - containerRect.left
      const mouseY = e.clientY - containerRect.top

      // Handle panning
      if (isPanning) {
        const dx = mouseX - panStart.x
        const dy = mouseY - panStart.y

        setPan((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }))

        setPanStart({ x: mouseX, y: mouseY })
        return
      }

      // Handle node dragging
      if (dragging) {
        // Adjust for current zoom and pan
        const adjustedX = (mouseX - pan.x) / zoom
        const adjustedY = (mouseY - pan.y) / zoom

        setNodes((prev) =>
          prev.map((node) => {
            if (node.id === dragging) {
              return {
                ...node,
                x: adjustedX + dragOffset.x,
                y: adjustedY + dragOffset.y,
              }
            }
            return node
          }),
        )
      }
    },
    [dragging, dragOffset, isPanning, panStart, zoom, pan],
  )

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    if (dragging && onGraphUpdate) {
      onGraphUpdate(nodes, edges)
    }

    setDragging(null)
    setIsPanning(false)
  }, [dragging, nodes, edges, onGraphUpdate])

  // Handle SVG mouse down for panning
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button

    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - containerRect.left
    const mouseY = e.clientY - containerRect.top

    setIsPanning(true)
    setPanStart({ x: mouseX, y: mouseY })
  }, [])

  // Handle mouse wheel for zooming
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      if (!containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - containerRect.left
      const mouseY = e.clientY - containerRect.top

      // Calculate zoom factor based on wheel delta
      const delta = -e.deltaY
      const zoomFactor = delta > 0 ? 1.1 : 0.9

      // Calculate new zoom level
      const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor))

      // Calculate mouse position in graph coordinates before zoom
      const mouseGraphX = (mouseX - pan.x) / zoom
      const mouseGraphY = (mouseY - pan.y) / zoom

      // Calculate new pan to keep mouse position fixed
      const newPanX = mouseX - mouseGraphX * newZoom
      const newPanY = mouseY - mouseGraphY * newZoom

      // Update state
      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    },
    [zoom, pan],
  )

  // Add and remove event listeners
  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    // Add wheel event listener to container
    const container = containerRef.current
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false })
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)

      if (container) {
        container.removeEventListener("wheel", handleWheel)
      }
    }
  }, [handleMouseMove, handleMouseUp, handleWheel])

  // Zoom functions
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.2, 0.1))
  }

  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Export graph as PNG
  const handleExport = () => {
    if (!svgRef.current) return

    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      canvas.width = svgRef.current!.clientWidth
      canvas.height = svgRef.current!.clientHeight
      ctx.drawImage(img, 0, 0)

      const a = document.createElement("a")
      a.download = "graph.png"
      a.href = canvas.toDataURL("image/png")
      a.click()
    }

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }

  // Handle node right-click for context menu
  const handleNodeRightClick = (e: React.MouseEvent, node: NodeWithPosition) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenuNode(node)
    setContextMenuPosition({
      x: e.clientX - containerRef.current!.getBoundingClientRect().left,
      y: e.clientY - containerRef.current!.getBoundingClientRect().top,
    })
    setShowContextMenu(true)
  }

  // Handle node click for selection
  const handleNodeClick = (e: React.MouseEvent, node: NodeWithPosition) => {
    // Only handle clicks, not drags
    if (dragging) return

    // Notify parent component if needed
    if (onNodeSelect) {
      onNodeSelect(node)
    }
  }

  // Handle node hover
  const handleNodeHover = (node: NodeWithPosition | null) => {
    setHoveredNode(node)
  }

  // Calculate node sizes based on sizing mode
  const getNodeSize = useCallback(
    (node: Node, index: number) => {
      if (nodeSizingMode === "uniform") {
        return 8
      }

      if (nodeSizingMode === "provided" && node.properties?.size !== undefined) {
        // Use size from properties, with a minimum of 4 and maximum of 20
        return Math.max(4, Math.min(20, Number(node.properties.size)))
      }

      // Count connections for incoming/outgoing modes
      const incomingCount = edges.filter((edge) => edge.to === node.id).length
      const outgoingCount = edges.filter((edge) => edge.from === node.id).length

      if (nodeSizingMode === "incoming") {
        const maxIncoming = Math.max(1, ...nodes.map((n) => edges.filter((e) => e.to === n.id).length))
        return 5 + (incomingCount / maxIncoming) * 15
      } else if (nodeSizingMode === "outgoing") {
        const maxOutgoing = Math.max(1, ...nodes.map((n) => edges.filter((e) => e.from === n.id).length))
        return 5 + (outgoingCount / maxOutgoing) * 15
      }

      return 8 // Default size
    },
    [nodes, edges, nodeSizingMode],
  )

  // Apply node color
  const handleApplyNodeColor = () => {
    if (!selectedNode) return

    setNodes((prev) =>
      prev.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            color: nodeColor,
          }
        }
        return node
      }),
    )

    setIsColorDialogOpen(false)

    // Notify parent of update
    if (onGraphUpdate) {
      const updatedNodes = nodes.map((node) => (node.id === selectedNode.id ? { ...node, color: nodeColor } : node))
      onGraphUpdate(updatedNodes, edges)
    }
  }

  // Open group color dialog
  const handleOpenGroupColorDialog = (group: string) => {
    setSelectedGroup(group)
    setGroupColor(customGroupColors[group] || colorScale[group])
    setGroupColorDialogOpen(true)
  }

  // Apply group color
  const handleApplyGroupColor = () => {
    if (!selectedGroup) return

    // Update custom group colors
    setCustomGroupColors((prev) => ({
      ...prev,
      [selectedGroup]: groupColor,
    }))

    // Update nodes that belong to this group and don't have custom colors
    setNodes((prev) =>
      prev.map((node) => {
        if (node.properties?.group === selectedGroup && !node.color) {
          return {
            ...node,
            color: groupColor,
          }
        }
        return node
      }),
    )

    setGroupColorDialogOpen(false)

    // Notify parent of update
    if (onGraphUpdate) {
      onGraphUpdate(nodes, edges)
    }
  }

  // Delete a node
  const handleDeleteNode = (nodeId: string) => {
    // Remove the node
    const updatedNodes = nodes.filter((node) => node.id !== nodeId)

    // Remove edges connected to this node
    const updatedEdges = edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)

    // Update state
    setNodes(updatedNodes)

    // Notify parent of update
    if (onGraphUpdate) {
      onGraphUpdate(updatedNodes, updatedEdges)
    }

    // Close context menu
    setShowContextMenu(false)
  }

  // Open color dialog from context menu
  const handleOpenColorDialog = () => {
    if (!contextMenuNode) return

    setSelectedNode(contextMenuNode)
    setNodeColor(
      contextMenuNode.color ||
        (contextMenuNode.properties?.group ? colorScale[contextMenuNode.properties.group] : colorScale["default"]),
    )
    setIsColorDialogOpen(true)
    setShowContextMenu(false)
  }

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setShowContextMenu(false)
    }

    if (showContextMenu) {
      document.addEventListener("click", handleClickOutside)
    }

    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [showContextMenu])

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-muted-foreground">
          {nodes.length} nodes, {edges.length} edges
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground mr-2">Zoom: {Math.round(zoom * 100)}%</div>
          <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleResetView} title="Reset View">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleExport} title="Export as PNG">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[500px] border border-gray-300 rounded-md bg-white overflow-hidden relative"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            cursor: isPanning ? "grabbing" : dragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleSvgMouseDown}
          onContextMenu={(e) => e.preventDefault()}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Draw edges */}
            {edges.map((edge, i) => {
              const source = nodes.find((n) => n.id === edge.from)
              const target = nodes.find((n) => n.id === edge.to)

              if (!source || !target) return null

              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="#999"
                    strokeWidth={1.5 / zoom}
                    strokeOpacity={0.6}
                    markerEnd="url(#arrow)"
                  />
                </g>
              )
            })}

            {/* Define arrow marker */}
            <defs>
              <marker
                id="arrow"
                viewBox="0 -5 10 10"
                refX={10}
                refY={0}
                markerWidth={6 / zoom}
                markerHeight={6 / zoom}
                orient="auto"
              >
                <path d="M0,-5L10,0L0,5" fill="#999" />
              </marker>
            </defs>

            {/* Draw nodes */}
            {nodes.map((node, index) => {
              const nodeSize = getNodeSize(node, index)
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseEnter={() => handleNodeHover(node)}
                  onMouseLeave={() => handleNodeHover(null)}
                >
                  <circle
                    r={nodeSize / zoom}
                    fill={
                      node.color || (node.properties?.group ? colorScale[node.properties.group] : colorScale["default"])
                    }
                    stroke="#fff"
                    strokeWidth={1.5 / zoom}
                    cursor="move"
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        // Left click
                        handleNodeMouseDown(e, node.id)
                      }
                    }}
                    onClick={(e) => handleNodeClick(e, node)}
                    onContextMenu={(e) => handleNodeRightClick(e, node)}
                  />
                  <text dx={12 / zoom} dy={4 / zoom} fontSize={10 / zoom} pointerEvents="none">
                    {node.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Context Menu */}
        {showContextMenu && contextMenuNode && (
          <div
            className="absolute z-50 bg-white rounded-md shadow-md border border-gray-200"
            style={{
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
            }}
          >
            <div
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
              onClick={handleOpenColorDialog}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-palette"
              >
                <circle cx="13.5" cy="6.5" r="2.5" />
                <path d="M19 11V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
                <path d="M13 22h7a2 2 0 0 0 2-2v-4h-3v-2a2 2 0 1 0-4 0v2h-3v.5" />
              </svg>
              <span>Change Color</span>
            </div>
            <div
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-red-500"
              onClick={() => handleDeleteNode(contextMenuNode.id)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-trash-2"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
              <span>Delete Node</span>
            </div>
          </div>
        )}
      </div>

      {groups.length > 1 && (
        <div className="mt-4 p-3 border border-gray-200 rounded-md">
          <h3 className="text-sm font-medium mb-2">Group Legend</h3>
          <div className="flex flex-wrap gap-4">
            {groups.map((group) => (
              <div key={group} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full cursor-pointer"
                  style={{ backgroundColor: customGroupColors[group] || colorScale[group] }}
                  onClick={() => handleOpenGroupColorDialog(group)}
                  title="Click to change group color"
                />
                <span className="text-sm">{group}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Node Color Dialog */}
      <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Node Color</DialogTitle>
            <DialogDescription>Select a new color for node {selectedNode?.label}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nodeColor" className="text-right">
                Color
              </Label>
              <Input
                id="nodeColor"
                type="color"
                value={nodeColor}
                onChange={(e) => setNodeColor(e.target.value)}
                className="col-span-3 h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleApplyNodeColor}>
              Apply Color
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Color Dialog */}
      <Dialog open={groupColorDialogOpen} onOpenChange={setGroupColorDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Group Color</DialogTitle>
            <DialogDescription>Select a new color for group {selectedGroup}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="groupColor" className="text-right">
                Color
              </Label>
              <Input
                id="groupColor"
                type="color"
                value={groupColor}
                onChange={(e) => setGroupColor(e.target.value)}
                className="col-span-3 h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleApplyGroupColor}>
              Apply Color
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Node Info Panel */}
      <div className="mt-4 p-3 border border-gray-200 rounded-md">
        <h3 className="text-sm font-medium mb-2">Node Information</h3>
        {hoveredNode ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor:
                    hoveredNode.color ||
                    (hoveredNode.properties?.group ? colorScale[hoveredNode.properties.group] : colorScale["default"]),
                }}
              />
              <span className="font-medium">{hoveredNode.label || hoveredNode.id}</span>
            </div>
            <div className="text-sm text-muted-foreground">ID: {hoveredNode.id}</div>
            {hoveredNode.properties && (
              <div className="mt-2">
                <div className="text-sm font-medium">Properties:</div>
                <pre className="bg-muted p-2 rounded-md text-xs overflow-auto max-h-32 mt-1">
                  {JSON.stringify(hoveredNode.properties, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Hover over a node to see its details</p>
        )}
      </div>

      <div className="text-sm text-muted-foreground mt-2">
        <span className="font-medium">Tip:</span> Drag nodes to reposition them. Right-click on a node to open a menu
        for changing color or deleting. Click on a node to view its details. Use mouse wheel to zoom in/out. Click and
        drag on the background to pan the view.
      </div>
    </div>
  )
}

