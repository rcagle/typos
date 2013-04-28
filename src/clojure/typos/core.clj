;; Copyright 2013 Russell Cagle

(ns typos.core
  (:require [clojure.data.json :as json]
            [clojure.string :as s]
            [clojure.java.io :as io])
  (:import [com.sun.jna Structure]
           [org.apache.commons.codec.binary Base64]
           [org.webbitserver WebServer WebServers WebSocketHandler]
           [org.webbitserver.handler StaticFileHandler]
           [com.sun.jna Library Native NativeLibrary Platform]
           [java.io FileDescriptor FileInputStream FileOutputStream
            OutputStreamWriter IOException]
           [java.util Random]
           [typos.structs Winsize]))

(def TIOCGWINSZ 1074295912)
(def TIOCSWINSZ 2148037735)
(def SIGHUP 1)
(def SIGWINCH 28)

(def connections (atom {}))

(def rng (Random.))

(defn to-java-fd [fd]
  (let [class-array (make-array Class 1)]
    (aset class-array 0 Integer/TYPE)
    (let [ctor (.getDeclaredConstructor FileDescriptor class-array)]
      (.setAccessible ctor true)
      (.newInstance ctor (to-array [(Integer. fd)])))))

(defn make-lib [libname]
  (let [lib (NativeLibrary/getInstance libname)]
    (fn [fname rtype & args]
      (.invoke (.getFunction lib fname) rtype (to-array args)))))

(def clib (make-lib "c"))
(def util (make-lib "util"))

(defn stream-seq
  ([is]
     (let [buffer (byte-array 1024)]
       (stream-seq is buffer)))
  ([is buffer]
     (try
       (let [bytes-read (.read is buffer)]
         (if (= bytes-read -1)
           nil
           (cons (String. buffer 0 bytes-read "UTF8") (lazy-seq (stream-seq is buffer)))))
       (catch Exception e (println "ignoring" e)))))

(defn open-pty [command args env]
  (let [pty-ptr (int-array [-1])
        env-and-defaults (merge (into {} (System/getenv)) env)
        env-arr (into-array
                 String
                 (map (fn [kv] (let [[key value] kv] (str key "=" value)))
                      env-and-defaults))
        pid (util "forkpty" Integer pty-ptr nil nil nil)]
    (if (= pid 0)
      (do
        (apply (partial clib "execle" Integer command)
               (concat args [nil env-arr])))
      (let [pty-fd (aget pty-ptr 0)
            java-fd (to-java-fd pty-fd)
            pty-r (FileInputStream. java-fd)
            pty-w (OutputStreamWriter. (FileOutputStream. java-fd) "UTF8")]
        {:pty-fd pty-fd
         :pty-r pty-r
         :pty-w pty-w
         :pid pid}))))

(defn resize [pty width height]
  (let [{:keys [pty-fd pid]} pty
        ws (Winsize.)]
    (clib "ioctl" Integer pty-fd TIOCGWINSZ ws)
    (.setWSRow ws height)
    (.setWSCol ws width)
    (clib "ioctl" Integer pty-fd TIOCSWINSZ ws)
    (clib "kill" Integer pid SIGWINCH)))

(defn on-message [connection json-message]
  (let [msg (json/read-json json-message)
        type (msg :type)
        data (msg :data)
        pty (@connections connection)]
    (case type
      "terminal_data" (let [{:keys [keys]} data]
                        (do (.append (pty :pty-w) keys) (.flush (pty :pty-w))))
      "resized" (let [{:keys [width height]} data] (resize pty width height)))))

(defn security-token
  ([] (security-token 32))
  ([size] 
     (let [bytes (byte-array size)]
       (.nextBytes rng bytes)
       (Base64/encodeBase64String bytes))))

(defn getlogin []
  (clib "getlogin" String))

(defn on-open [c]
  (let [token (security-token)
        pty (open-pty "/usr/bin/login" ["login (typos)" "-fp" (getlogin)]
                      {"TYPOS_TOKEN" token})]
    (.send c (json/json-str {:type "security_token" :message token}))
    (swap! connections assoc c pty)
    (.start (Thread.
             (fn []
               (doseq [pty-input (stream-seq (pty :pty-r))]
                 (.send c (json/json-str {:type "host_data" :message pty-input})))
               (.close c))))))

(defn -main []
  (doto (WebServers/createWebServer 8080)
    (.add "/websocket"
          (proxy [WebSocketHandler] []
            (onOpen [c]
              (on-open c))
            (onClose [c]
              (let [{:keys [pid pty-r pty-w]} (@connections c)]
                (try
                  (do
                    (.append pty-w "\004")
                    (.flush pty-w)
                    (.close pty-r)
                    (.close pty-w)
                    (clib "kill" Integer pid SIGHUP)))
                (swap! connections dissoc c)))
            (onMessage [c j]
              (on-message c j))))
    (.add (StaticFileHandler. "public"))
    (.start)))
