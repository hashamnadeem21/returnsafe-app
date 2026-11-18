import ExpoModulesCore
import UserNotifications

/// Reminder notifications on iOS: reads and asks for the notification permission.
public class ReminderNotificationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReminderNotifications")

    /// "granted", "denied" or "undetermined" (the system prompt has not been shown yet).
    AsyncFunction("getPermission") { (promise: Promise) in
      UNUserNotificationCenter.current().getNotificationSettings { settings in
        promise.resolve(Self.describe(settings.authorizationStatus))
      }
    }

    /// Shows the system prompt the first time; afterwards it returns the saved answer at once.
    AsyncFunction("requestPermission") { (promise: Promise) in
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) {
        _, _ in
        UNUserNotificationCenter.current().getNotificationSettings { settings in
          promise.resolve(Self.describe(settings.authorizationStatus))
        }
      }
    }
  }

  private static func describe(_ status: UNAuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "undetermined"
    case .denied: return "denied"
    default: return "granted"
    }
  }
}
