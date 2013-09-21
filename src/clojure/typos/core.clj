;; Copyright 2013 Russell Cagle

(ns typos.core
  (:require [clojure.data.json :as json]
            [clojure.string :as s]
            [clojure.java.io :as io]
            [clojure.tools.cli :as cli]
            [clojure.stacktrace :as st]
            [typos.native :as native])
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

(def clib (native/make-lib "c"))
(def typoslib (native/make-lib-from-resource "libtypos.so"))

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

(defn open-pty
  [command args env]
  (let [pty-ptr (int-array [-1])
        cmd-arr (into-array String (concat args [nil]))
        env-strings (->> env
                         (merge (into {} (System/getenv)))
                         (map (fn [[key value]] (str key "=" value))))
        env-arr (into-array String (concat env-strings [nil]))
        pid (typoslib "my_fork" Integer pty-ptr command cmd-arr env-arr)]
    (println "pid" pid)
    (if (> pid 0)
      (let [
            pty-fd (aget pty-ptr 0)
            java-fd (to-java-fd pty-fd)
            pty-r (FileInputStream. java-fd)
            pty-w (OutputStreamWriter. (FileOutputStream. java-fd) "UTF8")]
        {:pty-fd pty-fd
         :java-fd (to-java-fd pty-fd)
         :pty-r pty-r
         :pty-w pty-w
         :pid pid})
      (throw (RuntimeException. "openpty failed")))))

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

(defn show-help
  [banner]
  (println banner))

(defn close-pty
  [{:keys [pid pty-r pty-w]}]
  (println "closing pty")
  (try
    (.append pty-w "\004")
    (.flush pty-w)
    (.close pty-r)
    (.close pty-w)
    (catch Throwable whoops
      (println "caught" whoops)))
  (try
    (clib "kill" Integer pid SIGHUP)
    (catch Throwable whoops
      (println "caught" whoops))))

(defn run-app
  [port]
  (printf "Typos listening on http://localhost:%d\n" port)
  (doto (WebServers/createWebServer port)
    (.add "/websocket"
          (proxy [WebSocketHandler] []
            (onOpen [c]
              (on-open c))
            (onClose [c]
              (close-pty (@connections c))
              (swap! connections dissoc c))
            (onMessage [c j]
              (on-message c j))))
    (.add (StaticFileHandler. "public"))
    (.start)))

(defn parse-args
  [args]
  (cli/cli args
           ["-p" "--port" "Listen on this port"
            :parse-fn #(Integer. %) :default 8080]
           ["-?" "--help" "Print help" :flag true :default false]))

(defn -main
  [& args]
  (try
    (let [[parsed _ banner] (parse-args args)
          {:keys [port help]} parsed]
      (if help
        (show-help banner)
        (run-app port)))
    (catch Exception e
      (let [[_ _ banner] (parse-args [])]
        (println banner)
        (st/print-cause-trace e)))))
