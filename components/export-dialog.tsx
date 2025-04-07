"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { exportToPlantUML } from "@/lib/graph-parser"

interface ExportDialogProps {
  graphData: {
    nodes: any[]
    links: any[]
  }
}

export function ExportDialog({ graphData }: ExportDialogProps) {
  const [copied, setCopied] = useState(false)

  const plantUMLText = exportToPlantUML(graphData)

  const handleCopyPlantUML = () => {
    navigator.clipboard.writeText(plantUMLText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveImage = () => {
    // For D3 graph, we need to get the SVG
    const svgElement = document.querySelector("svg") as SVGSVGElement
    if (!svgElement) {
      alert("No visualization found to export")
      return
    }

    // Create a canvas to convert SVG to PNG
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      alert("Could not create canvas context")
      return
    }

    // Set canvas dimensions
    const svgRect = svgElement.getBoundingClientRect()
    canvas.width = svgRect.width
    canvas.height = svgRect.height

    // Create an image from the SVG
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      ctx.drawImage(img, 0, 0)

      // Create a temporary link element
      const link = document.createElement("a")
      link.download = "graph-visualization.png"
      link.href = canvas.toDataURL("image/png")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Export</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Export Graph</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="plantuml">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plantuml">PlantUML</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
          </TabsList>
          <TabsContent value="plantuml" className="space-y-4">
            <div className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[300px]">{plantUMLText}</pre>
            </div>
            <Button onClick={handleCopyPlantUML}>{copied ? "Copied!" : "Copy PlantUML"}</Button>
          </TabsContent>
          <TabsContent value="image" className="space-y-4">
            <p className="text-sm text-muted-foreground">Save the current graph visualization as a PNG image.</p>
            <Button onClick={handleSaveImage}>Save as PNG</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

