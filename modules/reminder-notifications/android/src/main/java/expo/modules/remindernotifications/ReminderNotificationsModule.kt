package expo.modules.remindernotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reminder notifications on Android: creates the "Return reminders" channel (high importance),
 * which the server sends every reminder on, and reports whether notifications are allowed.
 * Asking for the Android 13+ permission is done from JS with PermissionsAndroid.
 */
class ReminderNotificationsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReminderNotifications")

    OnCreate { ensureChannel() }

    Function("ensureChannel") { ensureChannel() }

    /** True when the app may show notifications (permission granted and not turned off). */
    Function("notificationsEnabled") {
      val context = appContext.reactContext ?: return@Function false
      val manager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      manager?.areNotificationsEnabled() ?: false
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val context = appContext.reactContext ?: return
    val manager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val channel =
      NotificationChannel(CHANNEL_ID, "Return reminders", NotificationManager.IMPORTANCE_HIGH)
    channel.description = "Reminders before a return window or warranty ends"
    // Creating a channel that already exists only updates its name and description.
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "return-reminders"
  }
}
