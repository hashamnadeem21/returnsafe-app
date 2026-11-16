package expo.modules.receipttext

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/** Reads the lines of text on a receipt photo with Google ML Kit, on the device. */
class ReceiptTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReceiptText")

    AsyncFunction("recognizeText") { fileUri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val uri = if (fileUri.startsWith("/")) Uri.fromFile(File(fileUri)) else Uri.parse(fileUri)
      val image = try {
        InputImage.fromFilePath(context, uri)
      } catch (e: Exception) {
        promise.reject("ERR_IMAGE", "The photo could not be opened.", e)
        return@AsyncFunction
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      recognizer
        .process(image)
        .addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { block ->
            block.lines.mapNotNull { line ->
              val box = line.boundingBox ?: return@mapNotNull null
              mapOf(
                "text" to line.text,
                "frame" to mapOf(
                  "left" to box.left.toDouble(),
                  "top" to box.top.toDouble(),
                  "right" to box.right.toDouble(),
                  "bottom" to box.bottom.toDouble(),
                ),
              )
            }
          }
          promise.resolve(lines)
        }
        .addOnFailureListener { e -> promise.reject("ERR_RECOGNIZE", e.message, e) }
        // One recognizer per photo: release it however the task ends.
        .addOnCompleteListener { recognizer.close() }
    }
  }
}
