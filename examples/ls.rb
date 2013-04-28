#!/usr/bin/env ruby
#
# Copyright 2013 Russell Cagle

e = Dir.entries(ARGV[0] || ".")

puts "\033]8080;#{ENV['TYPOS_TOKEN']};"
puts "<div style='font-family: sans-serif; font-size: 16px; color: white; width: 100%'>"
puts "<table>"
columns = 4
rows = (e.length + columns - 1) / columns
rows.times do |row|
  puts "<tr>"
  columns.times do |column|
    offset = row * columns + column
    puts "<td style='font-family: sans-serif; font-size: 16px; color: white;'> #{e[offset]} </td>"
  end
  puts "</tr>"
end
puts "</table>"
puts "<p>Field: <input type='text' value='An input'/></p>"
puts "</div>"
puts "\007"

puts "\033]8080;#{ENV['TYPOS_TOKEN']};"
puts "<h1 style='color: white; border: solid white 1px;'>Hi!</h1>\n"
puts "<h2 style='color: white'>there.</h2>"
puts "\007"

