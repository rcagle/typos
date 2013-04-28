#!/bin/bash

echo -e "\033]8080;$TYPOS_TOKEN;"
tee <<EOF 
<link href='//netdna.bootstrapcdn.com/twitter-bootstrap/2.2.2/css/bootstrap-combined.min.css' rel='stylesheet'>
<style>
.typos-fragment {
  font-family: Arial;
}
</style>
EOF
echo -e "\007"

