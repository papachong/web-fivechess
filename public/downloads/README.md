# 下载文件目录

将构建好的应用程序放在此目录下：

- `miu-fivechess-mac.dmg` - macOS 版本
- `miu-fivechess-win.exe` - Windows 版本  
- `miu-fivechess.ipa` - iOS 版本
- `miu-fivechess.apk` - Android 版本

## 构建命令

### macOS
```bash
npm run electron:build:mac
```

### Windows
```bash
npm run electron:build:win
```

### iOS
```bash
npm run cap:ios
# 然后在 Xcode 中 Archive 并导出 IPA
```

### Android
```bash
npm run cap:android
# 然后在 Android Studio 中 Build > Generate Signed Bundle/APK
```
