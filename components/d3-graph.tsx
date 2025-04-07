"use client"

import type React from "react"
import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import * as d3 from "d3"
import { ZoomIn, ZoomOut, Maximize, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface NodeData {
  id: string
  label: string
  properties?: {
    group?: string
    [key: string]: any
  }
  x?: number
  y?: number
  fx?: number
  fy?: number
  color?: string
}

interface LinkData {
  from: string
  to: string
}

interface GraphState {
  nodes: NodeData[]
  edges: LinkData[]
  groupColors: Record<string, string>
  version: string
}

interface D3GraphProps {
  nodes: NodeData[]
  edges: Array<{ from: string; to: string }>
  sizingMode: "uniform" | "incoming" | "outgoing"
  onGraphUpdate?: (nodes: NodeData[], edges: LinkData[]) => void
}

export function D3Graph({ nodes, edges, sizingMode, onGraphUpdate }: D3GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const nodeObjectsRef = useRef<NodeData[]>([])
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false)
  const [nodeColor, setNodeColor] = useState("#000000")
  const [groupColorDialogOpen, setGroupColorDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [groupColor, setGroupColor] = useState("#000000")
  const [customGroupColors, setCustomGroupColors] = useState<Record<string, string>>({})
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const isDraggingRef = useRef(false)
  const currentNodeRef = useRef<string | null>(null)
  const transformRef = useRef<d3.ZoomTransform | null>(null)

  // Extract unique groups from nodes
  const groups = useMemo(() => {
    return Array.from(new Set(nodes.map((node) => node.properties?.group || "default")))
  }, [nodes])

  // Create a color scale for groups, using custom colors if available
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

    const scale = d3.scaleOrdinal<string>().domain(groups).range(defaultColors)

    // Override with custom colors
    groups.forEach((group) => {
      if (customGroupColors[group]) {
        scale(group) // Initialize the scale
        // @ts-ignore - Directly set the output for this input
        scale.range()[scale.domain().indexOf(group)] = customGroupColors[group]
      }
    })

    return scale
  }, [groups, customGroupColors])

  // Calculate node sizes based on sizing mode
  const nodeSizes = useMemo(() => {
    if (sizingMode === "uniform") {
      return nodes.map(() => 8)
    }

    // Count connections
    const incomingCount: Record<string, number> = {}
    const outgoingCount: Record<string, number> = {}

    nodes.forEach((node) => {
      incomingCount[node.id] = 0
      outgoingCount[node.id] = 0
    })

    edges.forEach((edge) => {
      outgoingCount[edge.from] = (outgoingCount[edge.from] || 0) + 1
      incomingCount[edge.to] = (incomingCount[edge.to] || 0) + 1
    })

    if (sizingMode === "incoming") {
      const maxIncoming = Math.max(1, ...Object.values(incomingCount))
      return nodes.map((node) => 5 + (incomingCount[node.id] / maxIncoming) * 15)
    } else {
      const maxOutgoing = Math.max(1, ...Object.values(outgoingCount))
      return nodes.map((node) => 5 + (outgoingCount[node.id] / maxOutgoing) * 15)
    }
  }, [nodes, edges, sizingMode])

  // Handle node drag start
  const handleNodeMouseDown = useCallback((event: MouseEvent, nodeId: string) => {
    // Prevent default behavior and stop propagation
    event.preventDefault()
    event.stopPropagation()

    // Set dragging state
    isDraggingRef.current = true
    currentNodeRef.current = nodeId

    // Store current transform
    if (svgRef.current) {
      const transform = d3.zoomTransform(svgRef.current)
      transformRef.current = transform
    }

    // Add event listeners for drag and end
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [])

  // Handle mouse move during drag
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDraggingRef.current || !currentNodeRef.current || !svgRef.current || !containerRef.current) return

    // Prevent default behavior and stop propagation
    event.preventDefault()
    event.stopPropagation()

    // Get mouse position relative to SVG
    const svgRect = svgRef.current.getBoundingClientRect()
    const transform = transformRef.current || d3.zoomTransform(svgRef.current)

    // Calculate position in SVG coordinates
    const mouseX = event.clientX - svgRect.left
    const mouseY = event.clientY - svgRect.top

    // Adjust for current zoom/pan
    const x = (mouseX - transform.x) / transform.k
    const y = (mouseY - transform.y) / transform.k

    // Update node position
    const nodeElement = svgRef.current.querySelector(`circle[data-id="${currentNodeRef.current}"]`)
    if (nodeElement) {
      nodeElement.setAttribute("cx", String(x))
      nodeElement.setAttribute("cy", String(y))
    }

    // Update node label position
    const labelElement = svgRef.current.querySelector(`text[data-for="${currentNodeRef.current}"]`)
    if (labelElement) {
      labelElement.setAttribute("x", String(x))
      labelElement.setAttribute("y", String(y))
    }

    // Update connected edges
    const sourceEdges = svgRef.current.querySelectorAll(`line[data-source="${currentNodeRef.current}"]`)
    sourceEdges.forEach((edge) => {
      edge.setAttribute("x1", String(x))
      edge.setAttribute("y1", String(y))
    })

    const targetEdges = svgRef.current.querySelectorAll(`line[data-target="${currentNodeRef.current}"]`)
    targetEdges.forEach((edge) => {
      edge.setAttribute("x2", String(x))
      edge.setAttribute("y2", String(y))
    })
  }, [])

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      if (!isDraggingRef.current || !currentNodeRef.current || !svgRef.current) {
        // Clean up event listeners
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        return
      }

      // Prevent default behavior and stop propagation
      event.preventDefault()
      event.stopPropagation()

      // Get final position
      const nodeElement = svgRef.current.querySelector(`circle[data-id="${currentNodeRef.current}"]`)
      if (nodeElement) {
        const x = Number.parseFloat(nodeElement.getAttribute("cx") || "0")
        const y = Number.parseFloat(nodeElement.getAttribute("cy") || "0")

        // Update node data
        const nodeIndex = nodeObjectsRef.current.findIndex((n) => n.id === currentNodeRef.current)
        if (nodeIndex >= 0) {
          nodeObjectsRef.current[nodeIndex].x = x
          nodeObjectsRef.current[nodeIndex].y = y
          nodeObjectsRef.current[nodeIndex].fx = x
          nodeObjectsRef.current[nodeIndex].fy = y

          // Notify parent of update
          if (onGraphUpdate) {
            onGraphUpdate(nodeObjectsRef.current, edges)
          }
        }
      }

      // Reset dragging state
      isDraggingRef.current = false
      currentNodeRef.current = null
      transformRef.current = null

      // Clean up event listeners
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    },
    [edges, onGraphUpdate, handleMouseMove],
  )

  // Create a new graph from scratch
  const createGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return

    // Clear any existing content
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Get container dimensions
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    // Set SVG attributes
    svg.attr("width", width).attr("height", height).attr("viewBox", [0, 0, width, height])

    // Create a group for the graph content
    const g = svg.append("g")

    // Define arrow marker
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999")

    // Prepare node data with positions
    const nodeObjects = nodes.map((node, index) => {
      // If node has existing positions, use them
      if (node.x !== undefined && node.y !== undefined) {
        return {
          ...node,
          fx: node.x,
          fy: node.y,
        }
      }

      // For new nodes without positions, place them randomly
      const xPos = Math.random() * width * 0.8 + width * 0.1
      const yPos = Math.random() * height * 0.8 + height * 0.1

      return {
        ...node,
        x: xPos,
        y: yPos,
        fx: xPos,
        fy: yPos,
      }
    })

    // Store node objects for later use
    nodeObjectsRef.current = nodeObjects

    // Create links group
    const linksGroup = g.append("g").attr("class", "links")

    // Create links
    edges.forEach((edge) => {
      const source = nodeObjects.find((n) => n.id === edge.from)
      const target = nodeObjects.find((n) => n.id === edge.to)

      if (!source || !target) return

      linksGroup
        .append("line")
        .attr("stroke", "#999")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.6)
        .attr("marker-end", "url(#arrow)")
        .attr("x1", source.x)
        .attr("y1", source.y)
        .attr("x2", target.x)
        .attr("y2", target.y)
        .attr("data-source", source.id)
        .attr("data-target", target.id)
    })

    // Create nodes group
    const nodesGroup = g.append("g").attr("class", "nodes")

    // Create labels group
    const labelsGroup = g.append("g").attr("class", "labels")

    // Create nodes and labels
    nodeObjects.forEach((node, i) => {
      // Create node circle
      const circle = nodesGroup
        .append("circle")
        .attr("r", nodeSizes[i] || 8)
        .attr("cx", node.x)
        .attr("cy", node.y)
        .attr(
          "fill",
          node.color ||
            (node.properties?.group
              ? customGroupColors[node.properties.group] || colorScale(node.properties.group)
              : colorScale("default")),
        )
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("data-id", node.id)
        .attr("cursor", "move")

      // Add tooltip
      circle.append("title").text(() => {
        const nodeEdges = edges.filter((e) => e.from === node.id || e.to === node.id)
        const incomingCount = nodeEdges.filter((e) => e.to === node.id).length
        const outgoingCount = nodeEdges.filter((e) => e.from === node.id).length

        const connections =
          sizingMode === "uniform"
            ? ""
            : sizingMode === "incoming"
              ? `\nIncoming connections: ${incomingCount}`
              : `\nOutgoing connections: ${outgoingCount}`

        return `${node.label}${node.properties?.group ? `\nGroup: ${node.properties.group}` : ""}${connections}`
      })

      // Create node label
      labelsGroup
        .append("text")
        .attr("x", node.x)
        .attr("y", node.y)
        .attr("dx", 15)
        .attr("dy", 4)
        .attr("font-size", "10px")
        .text(node.label)
        .attr("data-for", node.id)

      // Add context menu on right-click
      circle.on("contextmenu", (event) => {
        event.preventDefault()

        // Remove any existing context menu
        d3.select(containerRef.current).selectAll(".context-menu").remove()

        // Create context menu
        const menu = d3
          .select(containerRef.current)
          .append("div")
          .attr("class", "context-menu absolute z-50 bg-white rounded-md shadow-md border border-gray-200")
          .style("left", `${event.pageX - containerRef.current!.getBoundingClientRect().left}px`)
          .style("top", `${event.pageY - containerRef.current!.getBoundingClientRect().top}px`)

        // Add color option
        menu
          .append("div")
          .attr("class", "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2")
          .html(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-palette"><circle cx="13.5" cy="6.5" r="2.5"/><path d="M19 11V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M13 22h7a2 2 0 0 0 2-2v-4h-3v-2a2 2 0 1 0-4 0v2h-3v.5"/></svg><span>Change Color</span>',
          )
          .on("click", () => {
            menu.remove()
            handleOpenNodeColorDialog(node)
          })

        // Add delete option
        menu
          .append("div")
          .attr("class", "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-red-500")
          .html(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg><span>Delete Node</span>',
          )
          .on("click", () => {
            menu.remove()
            deleteNode(node.id)
          })

        // Close menu when clicking elsewhere
        d3.select("body").on("click.contextmenu", () => {
          menu.remove()
          d3.select("body").on("click.contextmenu", null)
        })
      })

      // Add mousedown event for dragging
      circle.on("mousedown", (event) => {
        handleNodeMouseDown(event, node.id)
      })
    })

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        // Disable zoom when dragging a node
        return !isDraggingRef.current && !event.button
      })
      .on("zoom", (event) => {
        // Only apply zoom if not dragging
        if (!isDraggingRef.current) {
          g.attr("transform", event.transform)
          setZoomLevel(event.transform.k)
        }
      })

    // Store zoom reference
    zoomRef.current = zoom

    // Apply zoom to SVG
    svg.call(zoom)

    // Fit graph to view
    const fitToView = () => {
      if (!g.node()) return

      const bounds = g.node()!.getBBox()
      const padding = 40
      const fullWidth = width - padding * 2
      const fullHeight = height - padding * 2

      const scale = 0.9 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight)

      const translate = [
        (fullWidth - bounds.width * scale) / 2 - bounds.x * scale + padding,
        (fullHeight - bounds.height * scale) / 2 - bounds.y * scale + padding,
      ]

      svg
        .transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale))
    }

    // Initial fit to view
    fitToView()

    // Define zoom functions for external use
    window.d3ZoomFunctions = {
      zoomIn: () => {
        if (!zoomRef.current || !svg) return
        svg.transition().duration(300).call(zoomRef.current.scaleBy, 1.5)
      },
      zoomOut: () => {
        if (!zoomRef.current || !svg) return
        svg.transition().duration(300).call(zoomRef.current.scaleBy, 0.667)
      },
      fitToView: fitToView,
    }
  }, [nodes, edges, nodeSizes, colorScale, customGroupColors, sizingMode, onGraphUpdate, handleNodeMouseDown])

  // Delete a node
  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!svgRef.current || !nodeObjectsRef.current.length) return

      // Remove node from data
      const updatedNodes = nodeObjectsRef.current.filter((node) => node.id !== nodeId)
      nodeObjectsRef.current = updatedNodes

      // Remove edges connected to this node
      const updatedEdges = edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)

      // Remove node and connected elements from SVG
      const svg = d3.select(svgRef.current)
      svg.select(`.nodes circle[data-id="${nodeId}"]`).remove()
      svg.select(`.labels text[data-for="${nodeId}"]`).remove()
      svg.selectAll(`.links line[data-source="${nodeId}"]`).remove()
      svg.selectAll(`.links line[data-target="${nodeId}"]`).remove()

      // Notify parent of update
      if (onGraphUpdate) {
        onGraphUpdate(updatedNodes, updatedEdges)
      }

      // Clear selected node if it was deleted
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null)
      }
    },
    [edges, selectedNode, onGraphUpdate],
  )

  // Change node color
  const changeNodeColor = useCallback(
    (nodeId: string, color: string) => {
      if (!svgRef.current || !nodeObjectsRef.current.length) return

      // Update node color in data
      const updatedNodes = nodeObjectsRef.current.map((node) => {
        if (node.id === nodeId) {
          return { ...node, color }
        }
        return node
      })
      nodeObjectsRef.current = updatedNodes

      // Update node color in SVG
      d3.select(svgRef.current).select(`.nodes circle[data-id="${nodeId}"]`).attr("fill", color)

      // Notify parent of update
      if (onGraphUpdate) {
        onGraphUpdate(updatedNodes, edges)
      }
    },
    [edges, onGraphUpdate],
  )

  // Change group color
  const changeGroupColor = useCallback((group: string, color: string) => {
    // Update custom group colors
    setCustomGroupColors((prev) => ({
      ...prev,
      [group]: color,
    }))

    // Update all nodes in this group that don't have custom colors
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)

      // Get all nodes in this group
      const groupNodes = nodeObjectsRef.current.filter(
        (node) => (node.properties?.group || "default") === group && !node.color,
      )

      // Update each node's color
      groupNodes.forEach((node) => {
        svg.select(`.nodes circle[data-id="${node.id}"]`).attr("fill", color)
      })
    }
  }, [])

  // Export graph state
  const exportGraph = useCallback(() => {
    if (!nodeObjectsRef.current.length) return

    // Create graph state object
    const graphState: GraphState = {
      nodes: nodeObjectsRef.current,
      edges: edges,
      groupColors: customGroupColors,
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
  }, [edges, customGroupColors])

  // Import graph state
  const importGraph = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const graphState = JSON.parse(content) as GraphState

          // Validate data
          if (
            !graphState.nodes ||
            !Array.isArray(graphState.nodes) ||
            !graphState.edges ||
            !Array.isArray(graphState.edges)
          ) {
            alert("Invalid graph file format")
            return
          }

          // Import group colors
          if (graphState.groupColors) {
            setCustomGroupColors(graphState.groupColors)
          }

          // Update node objects reference
          nodeObjectsRef.current = graphState.nodes

          // Notify parent of update
          if (onGraphUpdate) {
            onGraphUpdate(graphState.nodes, graphState.edges)
          }

          // Recreate graph with imported data
          createGraph()
        } catch (error) {
          console.error("Error importing graph:", error)
          alert("Failed to import graph: " + (error instanceof Error ? error.message : "Unknown error"))
        }
      }

      reader.readAsText(file)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [onGraphUpdate, createGraph],
  )

  // Initialize graph on mount or when props change
  useEffect(() => {
    createGraph()

    return () => {
      // Clean up
      if (window.d3ZoomFunctions) {
        delete window.d3ZoomFunctions
      }

      // Remove any event listeners
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [createGraph, handleMouseMove, handleMouseUp])

  // Handle zoom buttons
  const handleZoomIn = () => {
    if (window.d3ZoomFunctions) {
      window.d3ZoomFunctions.zoomIn()
    }
  }

  const handleZoomOut = () => {
    if (window.d3ZoomFunctions) {
      window.d3ZoomFunctions.zoomOut()
    }
  }

  const handleResetZoom = () => {
    if (window.d3ZoomFunctions) {
      window.d3ZoomFunctions.fitToView()
    }
  }

  // Trigger file input click
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Open node color dialog
  const handleOpenNodeColorDialog = (node: NodeData) => {
    setSelectedNode(node)
    setNodeColor(
      node.color ||
        (node.properties?.group
          ? customGroupColors[node.properties.group] || colorScale(node.properties.group)
          : colorScale("default")),
    )
    setIsColorDialogOpen(true)
  }

  // Apply node color
  const handleApplyNodeColor = () => {
    if (selectedNode) {
      changeNodeColor(selectedNode.id, nodeColor)
    }
    setIsColorDialogOpen(false)
  }

  // Open group color dialog
  const handleOpenGroupColorDialog = (group: string) => {
    setSelectedGroup(group)
    setGroupColor(customGroupColors[group] || (colorScale(group) as string))
    setGroupColorDialogOpen(true)
  }

  // Apply group color
  const handleApplyGroupColor = () => {
    if (selectedGroup) {
      changeGroupColor(selectedGroup, groupColor)
    }
    setGroupColorDialogOpen(false)
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-muted-foreground">
          {nodes.length} nodes, {edges.length} edges
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground mr-2">Zoom: {Math.round(zoomLevel * 100)}%</div>
          <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleResetZoom} title="Reset Zoom">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={exportGraph} title="Export Graph">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleImportClick} title="Import Graph">
            <Upload className="h-4 w-4" />
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={importGraph} className="hidden" />
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[500px] border border-gray-300 rounded-md bg-white">
        <svg
          ref={svgRef}
          style={{ width: "100%", height: "100%", cursor: "grab" }}
          onClick={() => {
            // Remove any open context menus when clicking on the SVG
            d3.select(containerRef.current).selectAll(".context-menu").remove()
          }}
          onMouseDown={(e) => {
            // Only change cursor if not dragging a node
            if (!isDraggingRef.current && svgRef.current) {
              svgRef.current.style.cursor = "grabbing"
            }
          }}
          onMouseUp={() => {
            // Only change cursor if not dragging a node
            if (!isDraggingRef.current && svgRef.current) {
              svgRef.current.style.cursor = "grab"
            }
          }}
          onMouseLeave={() => {
            // Only change cursor if not dragging a node
            if (!isDraggingRef.current && svgRef.current) {
              svgRef.current.style.cursor = "grab"
            }
          }}
        />
      </div>

      {/* Group Legend */}
      {groups.length > 1 && (
        <div className="mt-4 p-3 border border-gray-200 rounded-md">
          <h3 className="text-sm font-medium mb-2">Group Legend</h3>
          <div className="flex flex-wrap gap-4">
            {groups.map((group) => (
              <div key={group} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full cursor-pointer"
                  style={{ backgroundColor: customGroupColors[group] || (colorScale(group) as string) }}
                  onClick={() => handleOpenGroupColorDialog(group)}
                  title="Click to change group color"
                />
                <span className="text-sm">{group}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground mt-2">
        <span className="font-medium">Tip:</span> Drag nodes to reposition them. Right-click on a node to open a menu
        for deleting or changing its color. Click on a group color in the legend to change it. Export your graph to save
        all positions and colors.
      </div>

      {/* Node Color Dialog */}
      <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Node Color</DialogTitle>
            <DialogDescription>Select a new color for node {selectedNode?.label || selectedNode?.id}</DialogDescription>
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
    </div>
  )
}

// Add type definition for window
declare global {
  interface Window {
    d3ZoomFunctions?: {
      zoomIn: () => void
      zoomOut: () => void
      fitToView: () => void
    }
  }
}

