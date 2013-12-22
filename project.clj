(defproject typos "0.0.0-SNAPSHOT"
  :description "Graphical command-line interface hosted in the browser."
  :dependencies [[org.clojure/clojure "1.5.1"]
                 [ring/ring-core "1.2.1"]
                 [ring/ring-jetty-adapter "1.2.1"]
                 [cheshire "5.3.0"]
                 [org.clojure/tools.logging "0.2.6"]
                 [org.eclipse.jetty/jetty-websocket "7.6.8.v20121106"]]
  :profiles
  {:dev {:dependencies [[clj-http "0.6.4"]]}})
