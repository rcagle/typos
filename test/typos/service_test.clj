(ns typos.service-test
  (:require [cheshire.core :as json]
            [typos.service :as service]
            [clojure.java.io :as io]
            [clj-http.client :as http]
            [ring.adapter.jetty :as jetty]
            [clojure.tools.logging :as logging])
  (:use [clojure.test])
  (:import [org.eclipse.jetty.websocket WebSocketClient WebSocketClientFactory
            WebSocketHandler WebSocket WebSocket$OnTextMessage]
           [java.io Closeable DataInputStream DataOutputStream PrintStream
            StringBufferInputStream ByteArrayOutputStream]
           [java.net Socket URI]
           [java.util.concurrent ExecutionException TimeUnit]
           (org.apache.commons.io.output WriterOutputStream)))

(def static-base (.getAbsolutePath (io/file "dev-resources/static")))

(defmacro with-start
  "Copy of with-open, calling stop instead of close."
  [bindings & body]
  (cond
    (= (count bindings) 0) `(do ~@body)
    (symbol? (bindings 0)) `(let ~(subvec bindings 0 2)
                              (try
                                (with-start ~(subvec bindings 2) ~@body)
                                (finally
                                  (. ~(bindings 0) stop))))
    :else (throw (IllegalArgumentException.
                  "with-open only allows Symbols in bindings"))))

(defn proxy-ws
  [messages]
  (let [c (promise)]
    (proxy [WebSocket WebSocket$OnTextMessage] []
      (onOpen [connection]
        (deliver c connection))
      (onClose [closeCode message])
      (onMessage [data]
        (swap! messages conj data)))))

(defn websocket-client
  "Returns a WebSocketConnection"
  [factory uri]
  (let [messages (atom [])
        client (.newWebSocketClient factory)
        connfuture (.open client uri (proxy-ws messages))
        connection (.get connfuture 5 TimeUnit/SECONDS)]
    {:messages messages :connection connection}))

(defn run-app
  "Returns the session id"
  [host port handler]
  (let [s (Socket. host port)
        in (DataInputStream. (.getInputStream s))
        out (DataOutputStream. (.getOutputStream s))]
    (service/send-message out (json/generate-string {:version "1.0"}))
    (let [ms (service/read-message in)
          mj (json/parse-string ms true)]
      (logging/info "run-app" ms mj)
      (service/in-thread
       (fn []
         (while (not (.isClosed s))
           (handler out (service/read-message in)))))
      (:session mj))))

(defn echo-app
  [out message]
  (logging/info "echo-app: got" message ", echoing it back")
  (service/send-message out message))

(deftest test-service
  (with-start [factory (doto (WebSocketClientFactory.)
                         (.start))
               server (service/create-server :http-port 1026
                                             :base static-base
                                             :jetty-options {:join? false})]
    (with-open [app-listener (service/run-app-listener 1025)]

      (is (= (:body (http/get "http://localhost:1026/hi.txt")) "hi\n")
          "should serve static files")

      (let [session (run-app "localhost" 1025 echo-app)
            {:keys [messages connection]} (websocket-client
                                           factory (-> (str "ws://localhost:1026/?session="  session)
                                                       (URI.)))]
        (.sendMessage connection "hello")
        (Thread/sleep 100)
        (is (= @messages ["hello"])))

      (is (thrown-with-msg? ExecutionException #"status 503"
            (websocket-client factory (URI. "ws://localhost:1026/?session=wrong")))))))
