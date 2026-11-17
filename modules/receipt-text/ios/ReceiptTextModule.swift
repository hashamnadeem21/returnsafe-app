import ExpoModulesCore
import ImageIO
import UIKit
import Vision

/// Reads the lines of text on a receipt photo with Apple Vision, on the device.
public class ReceiptTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptText")

    AsyncFunction("recognizeText") { (fileUri: String, promise: Promise) in
      let path = fileUri.hasPrefix("file://")
        ? (URL(string: fileUri)?.path ?? String(fileUri.dropFirst(7)))
        : fileUri
      guard let image = UIImage(contentsOfFile: path), let cgImage = image.cgImage else {
        promise.reject("ERR_IMAGE", "The photo could not be opened.")
        return
      }
      let width = CGFloat(cgImage.width)
      let height = CGFloat(cgImage.height)

      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          promise.reject("ERR_RECOGNIZE", error.localizedDescription)
          return
        }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        let lines: [[String: Any]] = observations.compactMap { observation in
          guard let text = observation.topCandidates(1).first?.string else { return nil }
          // Vision boxes are normalised with the origin at the bottom left.
          let box = observation.boundingBox
          return [
            "text": text,
            "frame": [
              "left": box.minX * width,
              "top": (1 - box.maxY) * height,
              "right": box.maxX * width,
              "bottom": (1 - box.minY) * height,
            ],
          ]
        }
        promise.resolve(lines)
      }
      request.recognitionLevel = .accurate
      // Receipts are mostly codes, prices and abbreviations; spelling correction hurts them.
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-US"]

      let orientation = CGImagePropertyOrientation(image.imageOrientation)
      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          promise.reject("ERR_RECOGNIZE", error.localizedDescription)
        }
      }
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
