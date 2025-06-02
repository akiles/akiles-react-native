#!/bin/bash

set -euxo pipefail

rm -rf docs
npx typedoc

# this is a workaround for https://cloud.google.com/storage/docs/gsutil/addlhelp/HowSubdirectoriesWork#potential-for-surprising-destination-subdirectory-naming
touch docs/.hello
gsutil cp docs/.hello gs://akiles-frontend/devsite/master/sdk/react-native/reference/.hello

GZIP_EXTENSIONS=html,js,css,json,otf,ttf,eot,png,svg
gsutil -h 'Cache-Control: public, max-age=60'    -m cp -r -z $GZIP_EXTENSIONS docs/*  gs://akiles-frontend/devsite/master/sdk/react-native/reference/
