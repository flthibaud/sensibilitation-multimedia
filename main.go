package main

import (
	"bufio"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s", r.RemoteAddr, r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

// noCache oblige le navigateur à revérifier chaque fichier : sans ça, il peut garder
// une ancienne version d'un script modifié et on ne voit pas ses changements
func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		next.ServeHTTP(w, r)
	})
}

// hideDotFiles empêche de servir les fichiers/dossiers cachés (.env, .git...)
func hideDotFiles(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for part := range strings.SplitSeq(r.URL.Path, "/") {
			if strings.HasPrefix(part, ".") {
				http.NotFound(w, r)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// loadEnv lit un fichier KEY=VALUE et place les variables dans l'environnement
// (sans écraser celles déjà définies dans le shell)
func loadEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		log.Printf("Pas de fichier %s : %v", path, err)
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
	if err := scanner.Err(); err != nil {
		log.Printf("Erreur de lecture de %s : %v", path, err)
	}
}

// restCountriesProxy relaie les requêtes vers l'API REST Countries en ajoutant la clé API,
// pour qu'elle ne soit jamais envoyée au navigateur
func restCountriesProxy(apiKey string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}

		url := "https://api.restcountries.com/countries/v5?" + r.URL.RawQuery
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, url, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)

		res, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer res.Body.Close()

		w.Header().Set("Content-Type", res.Header.Get("Content-Type"))
		w.WriteHeader(res.StatusCode)
		io.Copy(w, res.Body)
	}
}

func main() {
	const port = "8090"

	loadEnv(".env")
	apiKey := os.Getenv("RESTCOUNTRIES_API_KEY")
	if apiKey == "" {
		log.Printf("RESTCOUNTRIES_API_KEY absente : /api/countries ne fonctionnera pas")
	}

	http.Handle("/api/countries", loggingMiddleware(restCountriesProxy(apiKey)))

	fileserver := http.FileServer(http.Dir("."))
	http.Handle("/", loggingMiddleware(noCache(hideDotFiles(fileserver))))

	log.Printf("Serveur démarré sur http://localhost:%s", port)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
