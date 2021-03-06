const request = require('request-promise');
const { sha3_256 } = require('js-sha3');
const ByteBuffer = require('bytebuffer');
const VALID_BINARY_NAMES = ['variant', 'firmware.mfr', 'bootloader', 'bootstrap'];

const githubReleaseUrl = 'https://api.github.com/repos/keepkey/keepkey-firmware/releases';

function options(url, encoding = undefined) {
  return {
    url,
    encoding,
    headers: {
      'User-Agent': 'request',
    }
  };
}

async function getFlashAssets() {
  try {
    // get all tagged binary releases from github
    const response = await request(options(githubReleaseUrl));
    const data = JSON.parse(response);
    const rawPackagedAssets = await findFlashAssets(data);
    return JSON.stringify(rawPackagedAssets);
  }
  catch (error) {
    console.log('error with getting flash assets:', error);
  }
}

async function findFlashAssets(responseData) {
  try {
    let rawData = {};

    // pull tag and url from each release to download binary
    for (const jsonData of responseData) {
      const tagName = jsonData.tag_name;
      rawData[tagName] = {};

      for (const asset of jsonData.assets) {
        let assetName = asset.name;
        // download mfr firmware, bootstrap, and bootloader (no tar.bz2 or sig)
        if (validBinary(assetName)) {
          console.log('Downloading binary:', tagName, assetName)
          const url = asset.browser_download_url;
          const padTotal = assetName.includes('bootstrap') ? 16 : 256;
          rawData[tagName][assetName] = await packageRawAsset(url, padTotal);
        }
      }
    }

    return rawData;
  }
  catch (error) {
    console.log('error in finding flash assets:', error);
  }
}

function validBinary(binaryName) {
  return VALID_BINARY_NAMES.some(name => binaryName.includes(name));
}

async function packageRawAsset(url, padTotal) {
  try {
    let rawData;
    let rawAsset = {};
    const maxPadding = 1024*padTotal;

    // fetch binary for each tagged release
    const body = await request(options(url, null));

    // pad out any binary with 0xFFFFFFFF to 256k
    let data = ByteBuffer.wrap(body);
    if (body.length <= maxPadding) {
      rawData = ByteBuffer.allocate(maxPadding);
      rawData.fill(0xff);
      rawData.reset();
      data.prependTo(rawData, body.length);
    } else {
      rawData = ByteBuffer.wrap(body);
    }

    // create hash and base64 string
    rawAsset.hash = sha3_256(rawData.toArrayBuffer());
    rawAsset.base64 = rawData.toBase64();
    return rawAsset;
  }
  catch (error) {
    console.log('error in packaging raw assets:', error)
  }
}

module.exports.getFlashAssets = getFlashAssets;
