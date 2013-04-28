#!/usr/bin/env ruby

require 'github/markdown'

puts "\033]8080;#{ENV['TYPOS_TOKEN']};"
puts GitHub::Markdown.render(STDIN.read())
puts "\007"
