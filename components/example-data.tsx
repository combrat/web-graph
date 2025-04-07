"use client"

import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface ExampleDataProps {
  onApply: (connections: string, properties: string) => void
}

export function ExampleData({ onApply }: ExampleDataProps) {
  const smallExample = {
    connections: `A->B, B->C, C->D, D->A, A->C`,
    properties: `{
  "A": { "name": "Node A", "type": "source", "group": "Group 1", "description": "This is the starting node" },
  "B": { "name": "Node B", "type": "process", "group": "Group 1", "description": "This node processes data" },
  "C": { "name": "Node C", "type": "decision", "group": "Group 2", "description": "This node makes decisions" },
  "D": { "name": "Node D", "type": "sink", "group": "Group 2", "description": "This is the end node" }
}`,
  }

  const coloredArrowsExample = {
    connections: `A->B[#ff0000], B->C[#00ff00], C->D[#0000ff], D->A[#ffa500], A->C[#800080]`,
    properties: `{
"A": { "name": "Node A", "type": "source", "group": "Group 1", "description": "This is the starting node" },
"B": { "name": "Node B", "type": "process", "group": "Group 1", "description": "This node processes data" },
"C": { "name": "Node C", "type": "decision", "group": "Group 2", "description": "This node makes decisions" },
"D": { "name": "Node D", "type": "sink", "group": "Group 2", "description": "This is the end node" }
}`,
  }

  const largeExample = {
    connections: generateLargeExample(100).connections,
    properties: generateLargeExample(100).properties,
  }

  function generateLargeExample(nodeCount: number) {
    const connections: string[] = []
    const properties: Record<string, any> = {}
    const groups = ["Frontend", "Backend", "Database", "API", "Infrastructure"]
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ff00ff", "#00ffff", "#ffff00"]

    // Generate a connected graph
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = `N${i}`

      // Connect to 1-3 random nodes
      const connectionCount = Math.floor(Math.random() * 3) + 1
      for (let j = 0; j < connectionCount; j++) {
        const targetIndex = Math.floor(Math.random() * nodeCount)
        if (targetIndex !== i) {
          // Randomly add color to some connections
          if (Math.random() > 0.7) {
            const randomColor = colors[Math.floor(Math.random() * colors.length)]
            connections.push(`${nodeId}->N${targetIndex}[${randomColor}]`)
          } else {
            connections.push(`${nodeId}->N${targetIndex}`)
          }
        }
      }

      // Assign a random group
      const group = groups[Math.floor(Math.random() * groups.length)]

      // Add properties
      properties[nodeId] = {
        name: `Node ${i}`,
        type: ["source", "process", "decision", "sink"][Math.floor(Math.random() * 4)],
        group: group,
        value: Math.floor(Math.random() * 100),
        description: `This is node ${i} in the ${group} group`,
      }
    }

    return {
      connections: connections.join(", "),
      properties: JSON.stringify(properties, null, 2),
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Example Data</h2>
      <div className="flex flex-wrap gap-4">
        <Button variant="outline" onClick={() => onApply(smallExample.connections, smallExample.properties)}>
          Load Small Example (4 nodes, 2 groups)
        </Button>
        <Button
          variant="outline"
          onClick={() => onApply(coloredArrowsExample.connections, coloredArrowsExample.properties)}
        >
          Load Example with Colored Arrows
        </Button>
        <Button variant="outline" onClick={() => onApply(largeExample.connections, largeExample.properties)}>
          Load Large Example (100 nodes, 5 groups)
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="syntax">
          <AccordionTrigger>Syntax Guide</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Node Connections:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Basic connection: <code>A-&gt;B</code>
                </li>
                <li>
                  Colored connection: <code>A-&gt;B[#ff0000]</code> or <code>A-&gt;B[red]</code>
                </li>
                <li>
                  Multiple connections: <code>A-&gt;B, B-&gt;C, C-&gt;D</code>
                </li>
              </ul>

              <p className="mt-3">
                <strong>Node Properties:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>JSON format with node IDs as keys</li>
                <li>Common properties: name, group, type, size, value</li>
                <li>
                  Example: <code>{'{ "A": { "name": "Node A", "group": "Group 1" } }'}</code>
                </li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

