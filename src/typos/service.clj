(ns typos.service
  "A service that listens for websocket connections from the browser and
   client connections from applications and connects the two."
  (:require [cheshire.core :as json]
            [clojure.string :as s]
            [clojure.java.io :as io]
            [clojure.stacktrace :as st]
            [ring.middleware [file :as file] [file-info :as file-info]]
            [ring.adapter.jetty :as jetty]
            [clojure.tools.logging :as logging])
  (:import [java.io DataInputStream DataOutputStream EOFException]
           [java.net ServerSocket Socket SocketException]
           [org.eclipse.jetty.server.handler HandlerWrapper]
           [org.eclipse.jetty.server Server Request]
           [org.eclipse.jetty.websocket WebSocketHandler WebSocketServlet
            WebSocket WebSocket$OnTextMessage]))

(def connections "WebSocket -> connection" (atom {}))
(def sessions "session-id -> session" (atom {}))

(def app-handler (constantly {:status 404}))

(defn wrap
  "Wraps's `server`'s handler with `wrapper`."
  [server ^HandlerWrapper wrapper]
  (.setHandler wrapper (.getHandler server))
  (.setHandler server wrapper))

(defn read-message
  "Reads a network-byte-order int32 size, reads size bytes, and constructs a
   string from the bytes."
  [din]
  (let [size (.readInt din)
        buff (byte-array size)]
    (.readFully din buff 0 size)
    (String. buff 0 size)))

(defn send-message
  "Sends the message length as a network-byte-order int32, then the UTF-8
   encoded message bytes."
  [dout msg]
  (let [bytes (.getBytes msg "UTF-8")]
    (.writeInt dout (alength bytes))
    (.write dout bytes 0 (alength bytes))
    (.flush dout)))

(defn message-copier
  [is connection]
  (try
    (loop [buff (byte-array 1024)]
      (let [size (.readInt is)
            buff (if (> size (alength buff))
                   (byte-array size)
                   buff)
            _ (.readFully is buff 0 size)
            str (String. buff 0 size)]
        (.sendMessage connection str)
        (recur buff)))
    (catch EOFException t (logging/debug "message copier exited normally"))
    (catch Throwable t (logging/error t "in message-copier"))))

(defn accept-ws
  [{:keys [in out] :as session}]
  (proxy [WebSocket WebSocket$OnTextMessage] []
    (onOpen [connection]
      (let [conn-info {:session session
                       :web-socket this
                       :connection connection}]
        (swap! connections assoc this conn-info)
        (-> (Thread. #(message-copier in connection)) .start)))
    (onClose [closeCode message]
      (let [closing (@connections this)]
        ;; close the session
        (swap! connections dissoc this)))
    (onMessage [data]
      (let [connection (@connections this)
            out (get-in connection [:session :out])]
        (send-message out data)))))

(defn ws-handler
  [accept-fn]
  (proxy [WebSocketHandler] []
    (doWebSocketConnect [request protocol]
      (let [session-id (.getParameter request "session")]
        (logging/info "ws-handler session-id" session-id)
        (if-let [session (@sessions session-id)]
          (accept-fn session))))))

(defn in-thread
  [f]
  (.start
   (Thread.
    (fn []
      (try
        (f)
        (catch Throwable t
          (logging/error "whoops" t)))))))

(defn handle-client
  [cs]
  (let [session-id "1"
        in (DataInputStream. (.getInputStream cs))
        out (DataOutputStream. (.getOutputStream cs))
        session {:session-id session-id :in in :out out}]
    (try
      (let [conn-str (read-message in)
            _ (logging/info "handle-client got conn-str" conn-str)
            {:keys [version]} (json/parse-string conn-str true)]
        (logging/info "client connection, version" version ", session" session-id)
        (swap! sessions assoc session-id session)
        (send-message out (json/generate-string {:session session-id})))
      (catch Throwable e
        (send-message out (json/generate-string {:internal-error (str e)}))
        (throw e)))))

(defn run-app-listener
  [app-port]
  (let [ss (ServerSocket. app-port)]
    (in-thread
     (fn []
       (logging/info "hi there" app-port)
       (while (not (.isClosed ss))
         (let [cs (.accept ss)]
           (handle-client cs)))))
    ss))

(defn create-server
  [& {:keys [http-port base jetty-options]}]
  (let [app (-> app-handler
                (file/wrap-file base)
                (file-info/wrap-file-info))
        handler (ws-handler accept-ws)]

    (jetty/run-jetty app (merge {:port http-port :configurator #(wrap % handler)}
                                jetty-options))))

(defn run-app
  [app-port http-port secret base]
  (let [app-port (Integer/parseInt app-port)
        http-port (Integer/parseInt http-port)]
    (run-app-listener app-port)
    (.start (create-server :http-port http-port :base base))))

(defn show-help
  [args]
  (println (format "wrong number of args (%d)" (count args)))
  (println "usage: typos-service APP_PORT HTTP_PORT BASE"))

(defn -main
  [& args]
  (System/exit
   (try
     (if (not= (count args) 3)
       (do (show-help args), 1)
       (do (apply run-app args), 0))
     (catch Exception e
       (st/print-cause-trace e), 2))))
