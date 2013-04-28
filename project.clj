(defproject html-term "1.0.0-SNAPSHOT"
  :description "A terminal emulator that can render embedded HTML."
  :dependencies [[org.clojure/clojure "1.3.0"]
                 [org.webbitserver/webbit "0.4.3"]
                 [org.clojure/data.json "0.1.2"]
                 [net.java.dev.jna/jna "3.4.0"]
                 [net.java.dev.jna/platform "3.4.0"]
                 [commons-codec/commons-codec "1.7"]]
  :source-paths ["src/clojure"]
  :java-source-paths ["src/java"])

