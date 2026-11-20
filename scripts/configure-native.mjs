import { readFile, writeFile, access } from 'node:fs/promises';

async function addAndroidPermissions() {
  const path = 'android/app/src/main/AndroidManifest.xml';
  let xml = await readFile(path, 'utf8');
  const permissions = [
    '  <uses-permission android:name="android.permission.CAMERA" />',
    '  <uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '  <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
    '  <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
  ];
  for (const permission of permissions) {
    const name = permission.match(/android:name="([^"]+)"/)[1];
    if (!xml.includes(name)) xml = xml.replace('<application', permission + '\n  <application');
  }
  await writeFile(path, xml);
}
async function addIosUsageDescriptions() {
  const path = 'ios/App/App/Info.plist';
  let plist = await readFile(path, 'utf8');
  const entries = [
    ['NSCameraUsageDescription', 'O Plantonices usa a câmera para anexar fotos de hospitais e documentos.'],
    ['NSMicrophoneUsageDescription', 'O Plantonices usa o microfone quando você escolhe gravar um áudio.'],
    ['NSPhotoLibraryUsageDescription', 'O Plantonices acessa fotos apenas quando você escolhe anexá-las.'],
  ];
  for (const [key, value] of entries) {
    if (!plist.includes('<key>' + key + '</key>')) {
      plist = plist.replace('</dict>', '  <key>' + key + '</key>\n  <string>' + value + '</string>\n</dict>');
    }
  }
  await writeFile(path, plist);
}
const exists = async path => access(path).then(() => true).catch(() => false);
if (await exists('android/app/src/main/AndroidManifest.xml')) await addAndroidPermissions();
if (await exists('ios/App/App/Info.plist')) await addIosUsageDescriptions();
console.log('Permissões de câmera, microfone e biblioteca configuradas.');
