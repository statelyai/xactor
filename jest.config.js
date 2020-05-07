const path = require('path');
const { defaults, constants } = require('jest-config');
const { replacePathSepForRegex } = require('jest-regex-util');

module.exports = {
  transform: {
    [constants.DEFAULT_JS_PATTERN]: 'babel-jest',
  },
};
