let request = require('request-promise');
let { sha3_256 } = require('js-sha3');
let ByteBuffer = require('bytebuffer');

let githubReleaseUrl = 'https://api.github.com/repos/keepkey/keepkey-firmware/releases';

function options(url, encoding = undefined) {
  return {
    url: url,
    encoding: encoding,
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
    // console.log('final asssets', rawPackagedAssets)
    console.log('final asssets', JSON.stringify(rawPackagedAssets))
  }
  catch (error) {
    return false;
  }
}

async function findFlashAssets(responseData) {
  try {
    let rawData = {};

    // pull tag and url from each release to download binary
    for (const jsonData of responseData) {
      for (const asset of jsonData.assets) {
        // only download binary (no tar.bz2 or sig)
        if (asset.name.includes('.bin')) {
        console.log('Downloading binary from:', jsonData.tag_name, asset.name)
          let url = asset.browser_download_url;
          let padTotal = asset.name.includes('bootstrap') ? 16 : 256;
          rawData[jsonData.tag_name] = await packageRawAsset(url, asset.name, padTotal);
        }
      }
    }

    return rawData;
  }
  catch (error) {
    console.log('err', error);
  }
}

async function packageRawAsset(url, name, padTotal) {
  try {
    let rawData;
    let rawAsset = {};
    let sectorSize = 1024*padTotal;

    // fetch binary for each tagged release
    const body = await request(options(url, null));

    // pad out any binary with 0xFFFFFFFF to 256k
    let data = ByteBuffer.wrap(body);
    if (body.length <= sectorSize) {
      rawData = ByteBuffer.allocate(sectorSize);
      rawData.fill(0xff);
      rawData.reset();
      data.prependTo(rawData, body.length);
    } else {
      rawData = ByteBuffer.wrap(body);
    }

    // create hash and base64 string
    let hash = sha3_256(rawData.toArrayBuffer());
    // REMOVE SLICE!!
    let base64 = rawData.toBase64().slice(0, 100);
    rawAsset[name] = {
      hash: hash,
      base64: base64
    };
    return rawAsset;
  }
  catch (error) {
    return false;
  }
}

module.exports = getFlashAssets();
