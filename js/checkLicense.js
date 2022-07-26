const licenceChecker = (function licenceCheckModule() {
  const CWS_LICENSE_API_URL = 'https://www.googleapis.com/chromewebstore/v1.1/userlicenses/';
  let trialPeriodDays = 0;
  let verbose = false;
  let cachedResult;
  let tsCacheExpiration = 0;
  let accessToken;

  const init = function init(params) {
    if (params.trialPeriodDays) {
      trialPeriodDays = params.trialPeriodDays;
    }
    if (params.verbose) {
      verbose = true;
    }
  };

  const get = function get(cbProcessResult) {
    if (Date.now() < tsCacheExpiration) {
      if (verbose) {
        console.log('from cache', cachedResult);
      }
      cbProcessResult(cachedResult);
      return;
    }
    xhrWithAuth(
      'GET',
      CWS_LICENSE_API_URL + chrome.runtime.id,
      true,
      (error, status, response) => {
        const result = processResponse(error, status, response);
        cbProcessResult(result);
      }
    );
  };

  function processResponse(error, status, response) {
    if (verbose) {
      console.log(error, status, response);
    }
    const result = {};
    let data;
    if (status === 200) {
      data = JSON.parse(response);
      result.error = false;
      result.data = parseLicense(data);
      result.response = data;
      cachedResult = result;
    } else {
      result.error = true;
      result.response = response;
    }
    return result;
  }

  function parseLicense(license) {
    tsCacheExpiration = (parseInt(Date.now() / 1000, 10)
        + parseInt(license.maxAgeSecs, 10)) * 1000;
    if (!tsCacheExpiration) {
      tsCacheExpiration = 0;
    }
    if (license.result && license.accessLevel === 'FULL') {
      return 'FULL';
    } else if (license.result && license.accessLevel === 'FREE_TRIAL') {
      let daysAgoLicenseIssued = Date.now() - parseInt(license.createdTime, 10);
      daysAgoLicenseIssued = daysAgoLicenseIssued / 1000 / 60 / 60 / 24;
      if (trialPeriodDays && daysAgoLicenseIssued <= trialPeriodDays) {
        if (verbose) {
          console.log('Free trial, still within trial period');
        }
        return 'FREE_TRIAL';
      }
      if (verbose) {
        console.log('Free trial, trial period expired.');
      }
      return 'FREE_TRIAL_EXPIRED';
    }
    if (verbose) {
      console.log('No license ever issued.');
    }
    return 'NO_LICENSE';
  }

  function xhrWithAuth(method, url, interactive, callback) {
    let retry = true;
    getToken();

    function getToken() {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          callback(chrome.runtime.lastError);
          return;
        }
        accessToken = token;
        requestStart();
      });
    }

    function requestStart() {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.onload = requestComplete;
      xhr.send();
    }

    function requestComplete() {
      if (this.status === 401 && retry) {
        retry = false;
        chrome.identity.removeCachedAuthToken({ token: accessToken },
                                              getToken);
      } else {
        callback(null, this.status, this.response);
      }
    }
  }

  return {
    init,
    get
  };
}());

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.cmd === 'checkLicence') {
    licenceChecker.init({
      trialPeriodDays: 1,
      verbose: false
    });
    checkLicense((isAuthorised) => {
      sendResponse(isAuthorised);
    });
  }
  return true;
});

function checkLicense(cbContinue) {
  licenceChecker.get(result => {
    chrome.identity.getProfileUserInfo(userInfo => {
        debugger;
      if (result.data === 'FULL' || result.data === 'FREE_TRIAL') {
        cbContinue({
          email: userInfo.email,
          licenced: true
        });
      } else {
        cbContinue({
          email: userInfo.email,
          licenced: false
        });
      }
    });
  });
}