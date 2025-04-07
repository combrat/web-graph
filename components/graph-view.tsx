"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"

interface Node {
  id: string
  label: string
  x?: number
  y?: number
  color?: string
  properties?: Record<string, any>
}

interface Edge {
  from: string
  to: string
  color?: string
}

// Update the GraphViewProps interface to include the onFixNodeInfo prop
interface GraphViewProps {
  nodes: Node[]
  edges: Edge[]
  onGraphUpdate?: (nodes: Node[], edges: Edge[]) => void
  onNodeHover?: (node: Node | null) => void
  onZoomChange?: (zoom: number) => void
  nodeSizingMode: "uniform" | "incoming" | "outgoing" | "provided" | "property"
  nodeSizingProperty?: string
  onFixNodeInfo?: (node: Node) => void
  onDeleteNode?: (nodeId: string) => void
  fixedNode?: Node | null
}

// Update the function parameters to include onFixNodeInfo
export function GraphView({
  nodes: initialNodes,
  edges,
  onGraphUpdate,
  onNodeHover,
  onZoomChange,
  nodeSizingMode,
  nodeSizingProperty,
  onFixNodeInfo,
  onDeleteNode,
  fixedNode,
}: GraphViewProps) {
  // Container and SVG refs
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const isInitializedRef = useRef(false)

  // State for nodes with positions
  const [nodes, setNodes] = useState<Node[]>([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // Dragging state
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false)
  const [nodeColor, setNodeColor] = useState("#000000")
  const [groupColorDialogOpen, setGroupColorDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [groupColor, setGroupColor] = useState("#000000")
  const [customGroupColors, setCustomGroupColors] = useState<Record<string, string>>({})
  const [contextMenuNode, setContextMenuNode] = useState<Node | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [showContextMenu, setShowContextMenu] = useState(false)

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

    // Sort groups to ensure consistent color assignment
    const sortedGroups = [...groups].sort()

    sortedGroups.forEach((group, index) => {
      // Use custom color if available, otherwise use default color
      colorMap[group] = customGroupColors[group] || defaultColors[index % defaultColors.length]
    })

    return colorMap
  }, [groups, customGroupColors])

  // Initialize nodes with positions - only once on first render
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    // Initialize the node positions map
    initialNodes.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined && !isNaN(node.x) && !isNaN(node.y)) {
        // Use existing positions if available
        nodePositionsRef.current.set(node.id, { x: node.x, y: node.y })
      } else {
        // Generate random positions for new nodes
        nodePositionsRef.current.set(node.id, {
          x: Math.random() * (width - 100) + 50,
          y: Math.random() * (height - 100) + 50,
        })
      }
    })

    isInitializedRef.current = true
  }, []) // Empty dependency array - only run once

  // Update nodes when initialNodes change, preserving positions
  useEffect(() => {
    if (!isInitializedRef.current) return

    const nodesWithPositions = initialNodes.map((node) => {
      // Check if we have a stored position for this node
      const storedPosition = nodePositionsRef.current.get(node.id)

      if (storedPosition) {
        // Use stored position
        return {
          ...node,
          x: storedPosition.x,
          y: storedPosition.y,
        }
      } else if (node.x !== undefined && node.y !== undefined && !isNaN(node.x) && !isNaN(node.y)) {
        // Use position from the node itself if available
        nodePositionsRef.current.set(node.id, { x: node.x, y: node.y })
        return node
      } else if (containerRef.current) {
        // Generate a new position for this node
        const width = containerRef.current.clientWidth
        const height = containerRef.current.clientHeight
        const newPos = {
          x: Math.random() * (width - 100) + 50,
          y: Math.random() * (height - 100) + 50,
        }
        nodePositionsRef.current.set(node.id, newPos)
        return {
          ...node,
          x: newPos.x,
          y: newPos.y,
        }
      }

      return node
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
      if (!node || node.x === undefined || node.y === undefined) return

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

        const newX = adjustedX + dragOffset.x
        const newY = adjustedY + dragOffset.y

        // Update the node position in our ref
        nodePositionsRef.current.set(dragging, { x: newX, y: newY })

        setNodes((prev) =>
          prev.map((node) => {
            if (node.id === dragging) {
              return {
                ...node,
                x: newX,
                y: newY,
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
      // Create a copy of the edges with their colors preserved
      const updatedEdges = edges.map((edge) => ({
        ...edge,
        from: edge.from,
        to: edge.to,
        color: edge.color,
      }))

      onGraphUpdate(nodes, updatedEdges)
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

      // Notify parent of zoom change
      if (onZoomChange) {
        onZoomChange(newZoom)
      }
    },
    [zoom, pan, onZoomChange],
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

    // Add custom event listeners for external zoom controls
    const handleZoomIn = () => {
      setZoom((prev) => {
        const newZoom = Math.min(prev * 1.2, 5)
        if (onZoomChange) onZoomChange(newZoom)
        return newZoom
      })
    }

    const handleZoomOut = () => {
      setZoom((prev) => {
        const newZoom = Math.max(prev / 1.2, 0.1)
        if (onZoomChange) onZoomChange(newZoom)
        return newZoom
      })
    }

    const handleResetZoom = () => {
      setZoom(1)
      setPan({ x: 0, y: 0 })
      if (onZoomChange) onZoomChange(1)
    }

    const handleExportPng = () => {
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

    document.addEventListener("graph-zoom-in", handleZoomIn)
    document.addEventListener("graph-zoom-out", handleZoomOut)
    document.addEventListener("graph-reset-zoom", handleResetZoom)
    document.addEventListener("graph-export-png", handleExportPng)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("graph-zoom-in", handleZoomIn)
      document.removeEventListener("graph-zoom-out", handleZoomOut)
      document.removeEventListener("graph-reset-zoom", handleResetZoom)
      document.removeEventListener("graph-export-png", handleExportPng)

      if (container) {
        container.removeEventListener("wheel", handleWheel)
      }
    }
  }, [handleMouseMove, handleMouseUp, handleWheel, onZoomChange])

  // Handle node right-click for context menu
  const handleNodeRightClick = (e: React.MouseEvent, node: Node) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenuNode(node)
    setContextMenuPosition({
      x: e.clientX - containerRef.current!.getBoundingClientRect().left,
      y: e.clientY - containerRef.current!.getBoundingClientRect().top,
    })
    setShowContextMenu(true)
  }

  // Handle node hover
  const handleNodeHover = useCallback(
    (node: Node | null) => {
      if (onNodeHover) {
        onNodeHover(node)
      }
    },
    [onNodeHover],
  )

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

      if (nodeSizingMode === "property" && nodeSizingProperty && node.properties?.[nodeSizingProperty] !== undefined) {
        // Find the min and max values for this property across all nodes
        const values = nodes
          .map((n) => n.properties?.[nodeSizingProperty])
          .filter((v) => v !== undefined && !isNaN(Number(v)))
          .map((v) => Number(v))

        if (values.length === 0) return 8

        const min = Math.min(...values)
        const max = Math.max(...values)

        // If min and max are the same, return a default size
        if (min === max) return 8

        // Scale the value between 4 and 20
        const value = Number(node.properties[nodeSizingProperty])
        return 4 + ((value - min) / (max - min)) * 16
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
    [nodes, edges, nodeSizingMode, nodeSizingProperty],
  )

  // Delete a node
  const handleDeleteNode = (nodeId: string) => {
    // Remove the node from our position tracking
    nodePositionsRef.current.delete(nodeId)

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

    // Notify parent of node deletion
    if (onDeleteNode) {
      onDeleteNode(nodeId)
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

  // Calculate edge endpoints to connect to node edges instead of centers
  const calculateEdgeEndpoints = useCallback(
    (source: Node, target: Node) => {
      if (
        typeof source.x !== "number" ||
        typeof source.y !== "number" ||
        typeof target.x !== "number" ||
        typeof target.y !== "number" ||
        isNaN(source.x) ||
        isNaN(source.y) ||
        isNaN(target.x) ||
        isNaN(target.y)
      ) {
        return null
      }

      // Get node sizes
      const sourceSize = getNodeSize(source, nodes.indexOf(source))
      const targetSize = getNodeSize(target, nodes.indexOf(target))

      // Calculate direction vector
      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // If nodes are at the same position, return null
      if (distance === 0) return null

      // Normalize direction vector
      const nx = dx / distance
      const ny = dy / distance

      // Calculate edge endpoints
      const sourceX = source.x + nx * sourceSize
      const sourceY = source.y + ny * sourceSize
      const targetX = target.x - nx * targetSize
      const targetY = target.y - ny * targetSize

      return { sourceX, sourceY, targetX, targetY }
    },
    [nodes, getNodeSize],
  )

  // Check if an edge is outgoing from the fixed node
  const isOutgoingFromFixedNode = useCallback(
    (edge: Edge) => {
      return fixedNode && edge.from === fixedNode.id
    },
    [fixedNode],
  )

  // Get edge color based on edge properties and fixed node
  const getEdgeColor = useCallback(
    (edge: Edge) => {
      // If this edge is outgoing from the fixed node, highlight it
      if (isOutgoingFromFixedNode(edge)) {
        return "#ff3e00" // Bright orange highlight color
      }

      // Otherwise use the edge's color or default
      return edge.color || "#999"
    },
    [isOutgoingFromFixedNode],
  )

  // Get edge stroke width based on fixed node
  const getEdgeStrokeWidth = useCallback(
    (edge: Edge) => {
      // Make outgoing edges from fixed node thicker
      return isOutgoingFromFixedNode(edge) ? 2.5 / zoom : 1.5 / zoom
    },
    [isOutgoingFromFixedNode, zoom],
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-full border border-gray-300 rounded-md bg-white overflow-hidden relative"
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
          {/* Define arrow markers with different colors */}
          <defs>
            {/* Default arrow marker */}
            <marker
              id="arrow-default"
              viewBox="0 -5 10 10"
              refX="10"
              refY="0"
              markerWidth={6 / zoom}
              markerHeight={6 / zoom}
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill="#999" />
            </marker>

            {/* Highlighted arrow marker */}
            <marker
              id="arrow-highlight"
              viewBox="0 -5 10 10"
              refX="10"
              refY="0"
              markerWidth={6 / zoom}
              markerHeight={6 / zoom}
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill="#ff3e00" />
            </marker>

            {/* Generate markers for custom colors */}
            {edges
              .filter((edge) => edge.color)
              .map((edge) => {
                // Create a unique ID for each color
                const colorId = edge.color!.replace(/[^a-zA-Z0-9]/g, "")
                return (
                  <marker
                    key={`marker-${colorId}`}
                    id={`arrow-${colorId}`}
                    viewBox="0 -5 10 10"
                    refX="10"
                    refY="0"
                    markerWidth={6 / zoom}
                    markerHeight={6 / zoom}
                    orient="auto"
                  >
                    <path d="M0,-5L10,0L0,5" fill={edge.color} />
                  </marker>
                )
              })}
          </defs>

          {/* Draw edges */}
          {edges.map((edge, i) => {
            const source = nodes.find((n) => n.id === edge.from)
            const target = nodes.find((n) => n.id === edge.to)

            // Skip if nodes don't exist or don't have valid positions
            if (!source || !target) return null

            // Calculate edge endpoints
            const endpoints = calculateEdgeEndpoints(source, target)
            if (!endpoints) return null

            const { sourceX, sourceY, targetX, targetY } = endpoints

            // Determine edge color and marker
            const edgeColor = getEdgeColor(edge)
            const isHighlighted = isOutgoingFromFixedNode(edge)

            // Determine which marker to use
            let markerId
            if (isHighlighted) {
              markerId = "arrow-highlight"
            } else if (edge.color) {
              markerId = `arrow-${edge.color.replace(/[^a-zA-Z0-9]/g, "")}`
            } else {
              markerId = "arrow-default"
            }

            return (
              <g key={`edge-${i}`}>
                <line
                  x1={sourceX}
                  y1={sourceY}
                  x2={targetX}
                  y2={targetY}
                  stroke={edgeColor}
                  strokeWidth={getEdgeStrokeWidth(edge)}
                  strokeOpacity={0.8}
                  markerEnd={`url(#${markerId})`}
                />
              </g>
            )
          })}

          {/* Draw nodes */}
          {nodes.map((node, index) => {
            // Skip nodes with invalid positions
            if (typeof node.x !== "number" || typeof node.y !== "number" || isNaN(node.x) || isNaN(node.y)) return null

            const nodeSize = getNodeSize(node, index)
            const isFixed = fixedNode && fixedNode.id === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseEnter={() => handleNodeHover(node)}
                onMouseLeave={() => handleNodeHover(null)}
              >
                <circle
                  r={nodeSize}
                  fill={
                    node.color || (node.properties?.group ? colorScale[node.properties.group] : colorScale["default"])
                  }
                  stroke={isFixed ? "#ff3e00" : "#fff"}
                  strokeWidth={isFixed ? 3 / zoom : 1.5 / zoom}
                  cursor="move"
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      // Left click
                      handleNodeMouseDown(e, node.id)
                    }
                  }}
                  onContextMenu={(e) => handleNodeRightClick(e, node)}
                />
                <text dx={12} dy={4} fontSize={10 / zoom} pointerEvents="none" style={{ userSelect: "none" }}>
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
          {onFixNodeInfo && (
            <div
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
              onClick={() => {
                if (onFixNodeInfo) onFixNodeInfo(contextMenuNode)
                setShowContextMenu(false)
              }}
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
                className="lucide lucide-pin"
              >
                <line x1="12" x2="12" y1="17" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
              </svg>
              <span>Fix Node Info</span>
            </div>
          )}
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

      {/* Group Legend */}
      {groups.length > 1 && (
        <div className="absolute bottom-2 left-2 p-2 bg-white/80 rounded-md border border-gray-200 text-xs">
          <div className="font-medium mb-1">Groups:</div>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <div key={group} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: customGroupColors[group] || colorScale[group] }}
                />
                <span>{group}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

