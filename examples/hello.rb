require 'json'

msg = {type: :eval, js: "document.body.innerHTML += \"<h1>Hi</h1>\";"}.to_json
$stdout.write([msg.bytesize].pack("N"))
$stdout.write(msg)
