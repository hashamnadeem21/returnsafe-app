# Firebase config files

These files are not committed. Download them from the Firebase console and place them here.
iOS and Android both use the ID `com.returnsafe.app`.

| Path                            | Firebase project                                 | Used by                                        |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `dev/GoogleService-Info.plist`  | returnsafe-app                                   | iOS development builds (`APP_ENV=development`) |
| `dev/google-services.json`      | returnsafe-app                                   | Android development builds                     |
| `prod/GoogleService-Info.plist` | production project (to be created before launch) | iOS store builds (`APP_ENV=production`)        |
| `prod/google-services.json`     | production project (to be created before launch) | Android store builds                           |

For EAS cloud builds, upload them as EAS file environment variables instead of committing them.
