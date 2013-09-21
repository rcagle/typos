(ns typos.native
  "General-purpose native library-handling strategy."
  (:require [clojure.string :as s]
            [clojure.java.io :as io])
  (:import [com.sun.jna Library Native NativeLibrary Platform]
           [java.io FileDescriptor FileInputStream FileOutputStream
            OutputStreamWriter IOException]
           [java.io File]))

;; get-os and get-arch were copied from leiningen.core.utils

(defn- get-by-pattern
  "Gets a value from map m, but uses the keys as regex patterns, trying
  to match against k instead of doing an exact match."
  [m k]
  (m (first (drop-while #(nil? (re-find (re-pattern %) k))
                        (keys m)))))

(def ^:private native-names
  {"Mac OS X" :macosx "Windows" :windows "Linux" :linux
   "FreeBSD" :freebsd "OpenBSD" :openbsd
   "amd64" :x86_64 "x86_64" :x86_64 "x86" :x86 "i386" :x86
   "arm" :arm "SunOS" :solaris "sparc" :sparc "Darwin" :macosx})

(defn get-os
  "Returns a keyword naming the host OS."
  []
  (get-by-pattern native-names (System/getProperty "os.name")))

(defn get-arch
  "Returns a keyword naming the host architecture"
  []
  (get-by-pattern native-names (System/getProperty "os.arch")))

(defn native-dir
  []
  (s/join "/" ["native" (name (get-os)) (name (get-arch))]))

(defn print-native-resource-dir
  []
  (println (str "resources/" (native-dir))))

(defn make-lib [libname]
  (let [lib (NativeLibrary/getInstance libname)]
    (fn [fname rtype & args]
      (.invoke (.getFunction lib fname) rtype (to-array args)))))

(defn make-lib-from-resource
  "Creates a shared library from a resource."
  [libname]
  (let [f (File/createTempFile libname ".so")
        specific-path (s/join "/" [(native-dir) libname])]
    (println specific-path)
    (try
      (with-open [r (io/input-stream (io/resource specific-path))]
        (io/copy r f)
        (make-lib (.getAbsolutePath f)))
      (finally
        (.delete f)))))
