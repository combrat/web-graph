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

/**
 * Parse text input of node connections and properties into graph data
 */
export function parseGraphData(connectionsText: string, propertiesText: string): GraphData {
  console.log("Parsing graph data from:", connectionsText, propertiesText)

  const nodes: Map<string, Node> = new Map()
  const links: Link[] = []

  // Parse connections
  if (connectionsText.trim()) {
    const connections = connectionsText
      .split(/[,;\n]/)
      .map((conn) => conn.trim())
      .filter(Boolean)

    console.log("Parsed connections:", connections)

    for (const connection of connections) {
      // Support different connection formats: A->B, A => B, A - B, etc.
      // Also support optional color: A->B[#ff0000], A->B[red]
      const match = connection.match(/([^-=>\s]+)\s*(?:->|=>|—|–|-)\s*([^-=>\s[]+)(?:\[([^\]]+)\])?/)

      if (match) {
        const [, sourceId, targetId, color] = match
        console.log("Found connection:", sourceId, "->", targetId, color ? `(color: ${color})` : "")

        // Add nodes if they don't exist
        if (!nodes.has(sourceId)) {
          nodes.set(sourceId, { id: sourceId, name: sourceId })
        }

        if (!nodes.has(targetId)) {
          nodes.set(targetId, { id: targetId, name: targetId })
        }

        // Add link with optional color
        links.push({
          source: sourceId,
          target: targetId,
          color: color || undefined,
        })
      } else {
        console.warn("Could not parse connection:", connection)
      }
    }
  }

  // Parse properties
  if (propertiesText.trim()) {
    try {
      const properties = JSON.parse(propertiesText)
      console.log("Parsed properties:", properties)

      for (const [nodeId, nodeProps] of Object.entries(properties)) {
        if (nodes.has(nodeId)) {
          const node = nodes.get(nodeId)!
          node.properties = nodeProps as Record<string, any>

          // Use a property as name if available
          if (nodeProps && typeof nodeProps === "object" && "name" in nodeProps) {
            node.name = nodeProps.name
          }
        } else {
          // Create node if it doesn't exist yet
          nodes.set(nodeId, {
            id: nodeId,
            name: nodeId,
            properties: nodeProps as Record<string, any>,
          })
        }
      }
    } catch (error) {
      console.error("Error parsing JSON properties:", error)
      throw new Error(`Failed to parse node properties: ${error instanceof Error ? error.message : "Invalid JSON"}`)
    }
  }

  const result = {
    nodes: Array.from(nodes.values()),
    links: links,
  }

  console.log("Final graph data:", result)
  return result
}

/**
 * Generate a PlantUML text representation of the graph
 */
export function exportToPlantUML(graphData: GraphData): string {
  let plantUML = "@startuml\n"

  // Define node styles
  plantUML += "skinparam node {\n"
  plantUML += "  BackgroundColor white\n"
  plantUML += "  BorderColor black\n"
  plantUML += "  FontSize 12\n"
  plantUML += "}\n\n"

  // Define nodes
  for (const node of graphData.nodes) {
    const nodeId = node.id.replace(/[^a-zA-Z0-9_]/g, "_")
    const nodeName = node.name || node.id
    const nodeType = node.properties?.type || ""

    // Use custom color if available, otherwise use type-based color
    let nodeColor = node.color || ""
    if (!nodeColor) {
      if (nodeType === "source") nodeColor = "#4caf50"
      else if (nodeType === "process") nodeColor = "#2196f3"
      else if (nodeType === "decision") nodeColor = "#ff9800"
      else if (nodeType === "sink") nodeColor = "#f44336"
    }

    plantUML += `node "${nodeName}" as ${nodeId}`
    if (nodeColor) {
      // Convert hex to PlantUML color format if needed
      plantUML += ` #${nodeColor.replace("#", "")}`
    }
    plantUML += "\n"
  }

  plantUML += "\n"

  // Define connections
  for (const link of graphData.links) {
    const sourceId = (typeof link.source === "object" ? link.source.id : link.source).replace(/[^a-zA-Z0-9_]/g, "_")
    const targetId = (typeof link.target === "object" ? link.target.id : link.target).replace(/[^a-zA-Z0-9_]/g, "_")

    plantUML += `${sourceId} --> ${targetId}`

    // Add color if available
    if (link.color) {
      plantUML += ` #${link.color.replace("#", "")}`
    }

    plantUML += "\n"
  }

  plantUML += "@enduml"

  return plantUML
}

