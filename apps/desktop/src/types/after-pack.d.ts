declare module '*after-pack.cjs' {
  type AfterPackContext = {
    electronPlatformName: string;
    appOutDir: string;
    packager: { appInfo: { productFilename: string } };
  };

  const hardenPackagedMetadata: (context: AfterPackContext) => Promise<void>;
  export default hardenPackagedMetadata;
}
