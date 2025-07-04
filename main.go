package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed frontend/src/assets/dependency.json
var dependencyJSON []byte

//go:embed build/appicon.png
var icon []byte

func main() {

	core := NewCore()
	// Make dependency JSON available to core
	core.SetDependencyJSON(dependencyJSON)

	// Create application with options
	err := wails.Run(&options.App{
		Title:            "CEP",
		Width:            1160,
		Height:           800,
		MinWidth:         1160,
		MinHeight:        800,
		Assets:           assets,
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        core.startup,
		Bind: []interface{}{
			core,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
