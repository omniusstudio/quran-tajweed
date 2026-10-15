import AppKit

/// Whether the menu bar sits on a dark or a light part of the wallpaper, which decides the colour of the text.
/// macOS colours its own menu bar from the wallpaper, but a status item's view is not told which it chose, so the
/// wallpaper file is read (no screen-recording permission needed) and its brightness under the strip is measured.
enum WallpaperProbe {
    private static var cacheKey = ""
    private static var cacheValue: Bool?

    /// `frame` is the strip's frame in screen coordinates. Returns nil when the wallpaper cannot be read.
    static func isDarkUnder(_ frame: NSRect, on screen: NSScreen) -> Bool? {
        guard let url = NSWorkspace.shared.desktopImageURL(for: screen) else { return nil }
        let key = "\(url.path)|\(Int(frame.minX))-\(Int(frame.maxX))|\(Int(screen.frame.width))"
        if key == cacheKey { return cacheValue }
        cacheKey = key
        cacheValue = measure(url: url, frame: frame, screen: screen)
        return cacheValue
    }

    private static func measure(url: URL, frame: NSRect, screen: NSScreen) -> Bool? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let img = CGImageSourceCreateThumbnailAtIndex(src, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1600] as CFDictionary) else { return nil }
        let w = CGFloat(img.width), h = CGFloat(img.height)
        let sw = screen.frame.width, sh = screen.frame.height
        // the wallpaper fills the screen, centred and cropped (the usual setting)
        let scale = max(sw / w, sh / h)
        let ox = (sw - w * scale) / 2
        let oy = (sh - h * scale) / 2
        // the menu bar region, in the image's own pixels, measured from the top of the screen
        let x0 = max(0, (frame.minX - screen.frame.minX - ox) / scale)
        let x1 = min(w, (frame.maxX - screen.frame.minX - ox) / scale)
        let top = max(0, (0 - oy) / scale)
        let bottom = min(h, (34 - oy) / scale)
        guard x1 - x0 > 2, bottom - top > 1 else { return nil }
        let rect = CGRect(x: x0, y: top, width: x1 - x0, height: bottom - top)   // CGImage's origin is top-left
        guard let crop = img.cropping(to: rect) else { return nil }
        // average it down to one pixel
        var px = [UInt8](repeating: 0, count: 4)
        guard let ctx = CGContext(data: &px, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.interpolationQuality = .medium
        ctx.draw(crop, in: CGRect(x: 0, y: 0, width: 1, height: 1))
        let lum = (0.2126 * Double(px[0]) + 0.7152 * Double(px[1]) + 0.0722 * Double(px[2])) / 255
        return lum < 0.52
    }
}
