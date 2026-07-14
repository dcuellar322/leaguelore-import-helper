const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const plist = require('plist');

module.exports = async function hardenPackagedMetadata(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const infoPath = join(context.appOutDir, `${appName}.app`, 'Contents', 'Info.plist');
  const info = plist.parse(await readFile(infoPath, 'utf-8'));

  info.NSAppTransportSecurity = {
    NSAllowsArbitraryLoads: false,
    NSAllowsLocalNetworking: true
  };
  for (const key of [
    'NSAudioCaptureUsageDescription',
    'NSBluetoothAlwaysUsageDescription',
    'NSBluetoothPeripheralUsageDescription',
    'NSCameraUsageDescription',
    'NSMicrophoneUsageDescription'
  ]) delete info[key];

  await writeFile(infoPath, plist.build(info), 'utf-8');
};
