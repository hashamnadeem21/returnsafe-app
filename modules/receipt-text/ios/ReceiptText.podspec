Pod::Spec.new do |s|
  s.name           = 'ReceiptText'
  s.version        = '1.0.0'
  s.summary        = 'On-device text recognition for receipt photos (Apple Vision).'
  s.description    = 'Reads the lines of text on a receipt photo with their positions.'
  s.license        = 'UNLICENSED'
  s.author         = 'ReturnSafe'
  s.homepage       = 'https://github.com/hashamnadeem21/returnsafe-app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
