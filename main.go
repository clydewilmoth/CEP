package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func main() {

	core := NewCore()

	// Create application with options
	err := wails.Run(&options.App{
		Title:            "CEP",
		Width:            1280,
		Height:           960,
		Assets:           assets,
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        core.startup,
		OnBeforeClose:    core.beforeClose,
		Bind: []interface{}{
			core,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
