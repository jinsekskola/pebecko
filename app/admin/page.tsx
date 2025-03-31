"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  description: string | null;
  _count: { votes: number };
};

export default function AdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [codes, setCodes] = useState<
    {
      isAdmin: boolean;
      id: string;
      code: string;
      disabled: boolean;
    }[]
  >([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setSuccess(
          "Ověřování, zda má uživatel administrativní oprávnění... (1/3)"
        );
        const code = localStorage.getItem("adminCode");
        if (!code) {
          router.push("/");
          return;
        }
        setSuccess(
          "Ověřování, zda má uživatel administrativní oprávnění... (2/3)"
        );

        // Verify if the code has admin privileges
        let verifyResponse;
        try {
          verifyResponse = await fetch("/api/code", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-auth-code": code,
            },
            body: JSON.stringify({ code }),
          });
        } catch (networkError) {
          console.error("Network error during verification:", networkError);
          throw new Error(
            "Nelze se připojit k serveru. Zkontrolujte své připojení k internetu."
          );
        }

        setSuccess(
          "Ověřování, zda má uživatel administrativní oprávnění... (3/3)"
        );

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json();
          throw new Error(
            errorData.error ||
              `Verification failed with status: ${verifyResponse.status}`
          );
        }

        setSuccess(
          "Ověřeno. Pokuď uživatel nemá administrativní oprávnění, bude poslán zpět na domovskou obrazovku."
        );
        const verifyResult = await verifyResponse.json();
        if (!verifyResult.isAdmin) {
          router.push("/");
          return;
        }

        setSuccess("Ověřeno.");

        // Fetch projects and codes separately with better error handling
        let projectsData = [];
        let codesData = [];

        setSuccess("Začíním načítat data ze serveru... (projekty)");
        // Fetch projects
        try {
          const projectsResponse = await fetch("/api/project", {
            headers: {
              "Content-Type": "application/json",
              "x-auth-code": code,
            },
          });

          if (!projectsResponse.ok) {
            const projectError = await projectsResponse.json();
            console.error("Project fetch error:", projectError);
            throw new Error(
              projectError.error ||
                `Failed to fetch projects: ${projectsResponse.status}`
            );
          }

          const data = await projectsResponse.json();
          projectsData = Array.isArray(data) ? data : [];
        } catch (projectError) {
          console.error("Error fetching projects:", projectError);
          throw new Error(
            projectError instanceof Error
              ? projectError.message
              : "Failed to fetch projects data"
          );
        }

        setSuccess("Začíním načítat data ze serveru... (kódy)");

        // Fetch codes
        try {
          const codesResponse = await fetch("/api/code", {
            headers: {
              "Content-Type": "application/json",
              "x-auth-code": code,
            },
          });

          if (!codesResponse.ok) {
            const codeError = await codesResponse.json();
            console.error("Code fetch error:", codeError);
            throw new Error(
              codeError.error ||
                `Failed to fetch codes: ${codesResponse.status}`
            );
          }

          const data = await codesResponse.json();
          codesData = Array.isArray(data) ? data : [];
        } catch (codeError) {
          console.error("Error fetching codes:", codeError);
          throw new Error(
            codeError instanceof Error
              ? codeError.message
              : "Failed to fetch codes data"
          );
        }

        setSuccess("Data načteny.");

        setProjects(projectsData);
        setCodes(codesData);
        setSuccess("");
      } catch (error: any) {
        console.error("Admin data fetch error:", error);
        setError(
          "Nepodařilo se načíst administrátorská data: " +
            (error.message || error.toString())
        );
        // Uncomment if you want to redirect on error
        // router.push('/');
      }
    };

    fetchData();
    setSuccess("");
  }, []);

  const handleCreateProject = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      const code = localStorage.getItem("adminCode");
      if (!code) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-code": code,
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error);
        return;
      }

      const projectsResponse = await fetch("/api/project", {
        headers: {
          "Content-Type": "application/json",
          "x-auth-code": code,
        },
      });
      const projectsData = await projectsResponse.json();
      setProjects(projectsData);
      setSuccess("Projekt byl úspěšně vytvořen!");
      setError("");
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setError("Nepodařilo se vytvořit projekt");
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      if (
        !confirm(
          "Opravdu chcete smazat tento projekt? Toto také smaže všechny hlasy pro tento projekt."
        )
      ) {
        setSuccess("Akce byla úspěšně zrušena.");
        setTimeout(() => setSuccess(""), 2000);
        return;
      }

      const code = localStorage.getItem("adminCode");
      if (!code) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/project/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-auth-code": code,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error);
        return;
      }

      const projectsResponse = await fetch("/api/project", {
        headers: {
          "x-auth-code": code,
        },
      });
      const projectsData = await projectsResponse.json();
      setProjects(projectsData);
      setSuccess("Projekt byl úspěšně smazán!");
      setError("");
      setTimeout(() => setSuccess(""), 2000);
    } catch (error) {
      setError("Nepodařilo se smazat projekt");
    }
  };

  const handleCreateCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const codeValue = formData.get("code") as string;

    try {
      const adminCode = localStorage.getItem("adminCode");
      if (!adminCode) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/code", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-auth-code": adminCode,
        },
        body: JSON.stringify({ code: codeValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error);
        return;
      }

      const codesResponse = await fetch("/api/code", {
        headers: {
          "x-auth-code": adminCode,
        },
      });
      const codesData = await codesResponse.json();
      setCodes(codesData);
      setSuccess("Kód byl úspěšně vytvořen!");
      setError("");
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setError("Nepodařilo se vytvořit kód");
    }
  };

  const handleCreateBulkCodes = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const codesText = formData.get("codes") as string;
    const codesList = codesText
      .split("\n")
      .map((code) => code.trim())
      .filter(Boolean);

    try {
      const adminCode = localStorage.getItem("adminCode");
      if (!adminCode) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/code", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-auth-code": adminCode,
        },
        body: JSON.stringify({ codes: codesList }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error);
        return;
      }

      const codesResponse = await fetch("/api/code", {
        headers: {
          "x-auth-code": adminCode,
        },
      });
      const codesData = await codesResponse.json();
      setCodes(codesData);
      setSuccess(`${codesList.length} kódů bylo úspěšně vytvořeno!`);
      setError("");
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setError("Nepodařilo se vytvořit kódy");
    }
  };

  const generateCodes = async (count: number) => {
    try {
      // Generate unique codes
      const generatedCodes = new Set<string>();
      while (generatedCodes.size < count) {
        const code = Array.from({ length: 7 }, () => {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          return chars.charAt(Math.floor(Math.random() * chars.length));
        }).join("");
        generatedCodes.add(code);
      }

      const genCodes = Array.from(generatedCodes);
      const adminCode = localStorage.getItem("adminCode");
      if (!adminCode) {
        router.push("/");
        return;
      }

      // Create codes one by one using PATCH method
      for (const codeValue of genCodes) {
        const response = await fetch("/api/code", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-auth-code": adminCode,
          },
          body: JSON.stringify({ code: codeValue }),
        });

        if (!response.ok) {
          const error = await response.json();
          setError(error.message);
          return;
        }
      }

      // Create a blob with the codes
      const blob = new Blob([genCodes.join("\n")], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated-codes.txt";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setError("");
      setSuccess(`Vygenerováno ${count} kódů a staženo`);
      setTimeout(() => setSuccess(""), 2000);

      // Refresh codes list
      const codesResponse = await fetch("/api/code", {
        headers: {
          "x-auth-code": adminCode,
        },
      });
      const codesData = await codesResponse.json();
      setCodes(codesData);
    } catch (error) {
      setError("Došlo k chybě");
    }
  };

  const handleDeleteCode = async (id: string, codeValue: string) => {
    try {
      if (
        !confirm(
          "Opravdu chcete smazat kód " +
            codeValue +
            "? Toto také smaže hlasy provedené tímto kódem."
        )
      ) {
        setSuccess("Akce byla úspěšně zrušena.");
        setTimeout(() => setSuccess(""), 2000);
        return;
      }

      const adminCode = localStorage.getItem("adminCode");
      if (!adminCode) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/code/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-auth-code": adminCode,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete code");
        return;
      }

      const codesResponse = await fetch("/api/code", {
        headers: {
          "x-auth-code": adminCode,
        },
      });
      const codesData = await codesResponse.json();
      setCodes(codesData);
      setSuccess("Kód byl úspěšně smazán!");
      setError("");
      setTimeout(() => setSuccess(""), 2000);
    } catch (error) {
      setError("Nepodařilo se smazat kód");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Administrátorský panel</h1>

      <div className="mb-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 rounded-lg border border-white/10">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
            OpenDecision
          </h2>

          <p className="text-gray-300 mb-4">
            Moderní alternativa decision21.cz, vytvořená pomocí NextJS a
            databází od Prismy.
            <br />
            Zdarma. OpenSource.
          </p>

          <div className="flex flex-col gap-2 text-sm text-gray-400">
            <p>
              <span className="font-medium text-gray-300">Autor:</span> JinSeK a
              podporovatelé
            </p>
            <p>
              <span className="font-medium text-gray-300">Verze:</span> Neznámá
            </p>
          </div>

          <div className="mt-4">
            <a
              href="https://github.com/jintosek/pebecko"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-700 text-white p-4 rounded mb-4">
          <b>{error}</b>
        </div>
      )}
      {success && (
        <div className="bg-green-600 text-white p-4 rounded mb-4">
          <b>{success}</b>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">Projekty</h2>
          <form
            onSubmit={handleCreateProject}
            className="bg-white/5 p-4 rounded mb-4"
          >
            <div className="mb-4">
              <label htmlFor="name" className="block mb-2">
                Název
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full p-2 rounded bg-white/10"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="description" className="block mb-2">
                Popis
              </label>
              <textarea
                id="description"
                className="w-full p-2 rounded bg-white/10"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Vytvořit projekt
            </button>
          </form>

          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white/5 p-4 rounded flex justify-between items-center"
              >
                <div>
                  <h3 className="font-bold">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm opacity-70">{project.description}</p>
                  )}
                  <p className="text-xs">
                    Hlasů:{" "}
                    <a className="font-bold text-base">
                      {project._count.votes}
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  Smazat
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Kódy</h2>
          <form
            onSubmit={handleCreateCode}
            className="hidden bg-white/5 p-4 rounded mb-4"
          >
            <div className="mb-4 hidden">
              <label htmlFor="code" className="block mb-2">
                Jednotlivý kód
              </label>
              <input
                type="text"
                id="code"
                name="code"
                required
                className="w-full p-2 rounded bg-white/10"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Vytvořit kód
            </button>
          </form>

          <form
            onSubmit={handleCreateBulkCodes}
            className="bg-white/5 p-4 rounded mb-4"
          >
            <div className="mb-4">
              <label htmlFor="codes" className="block mb-2">
                Hromadné kódy (jeden na řádek)
              </label>
              <textarea
                id="codes"
                name="codes"
                required
                className="w-full p-2 rounded bg-white/10 h-32"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Vytvořit hromadné kódy
            </button>
          </form>

          <form className="bg-white/5 p-4 rounded mb-4">
            <div className="mb-4">
              <label htmlFor="codeCount" className="block mb-2">
                Generovat náhodné kódy
              </label>
              <div className="flex gap-4">
                <input
                  type="number"
                  id="codeCount"
                  min="1"
                  placeholder="Počet kódů ke generování"
                  className="flex-1 p-2 rounded bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => {
                    const count = parseInt(
                      (document.getElementById("codeCount") as HTMLInputElement)
                        .value
                    );
                    if (count > 0) generateCodes(count);
                    else {
                      setError("Zadejte platný počet kódů");
                      (
                        document.getElementById("codeCount") as HTMLInputElement
                      ).value = "";
                      const button = document.querySelector(
                        'button[type="button"]'
                      ) as HTMLButtonElement;
                      button.disabled = true;
                      button.classList.remove("bg-blue-500");
                      button.classList.add("bg-gray-500", "cursor-not-allowed");
                    }
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Generovat
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-2">
            {[...codes]
              .filter((code) => code.isAdmin === false)
              .sort((a, b) =>
                a.disabled === b.disabled ? 0 : a.disabled ? 1 : -1
              )
              .map((code) => (
                <div
                  key={code.id}
                  className={`p-2 rounded ${
                    code.disabled ? "bg-gray-500/20" : "bg-white/5"
                  } flex justify-between items-center`}
                >
                  <code>{code.code}</code>
                  <div className="flex items-center gap-2">
                    {code.disabled ? (
                      <span className="ml-2 text-sm opacity-70">(Použito)</span>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            if (
                              !confirm(
                                "Opravdu chcete označit tento kód jako použitý? Tento kód bude znehodnocen a nebude moci být použit znovu."
                              )
                            ) {
                              setSuccess("Akce byla úspěšně zrušena.");
                              setTimeout(() => setSuccess(""), 2000);
                              return;
                            }
                            const adminCode = localStorage.getItem("adminCode");
                            if (!adminCode) {
                              router.push("/");
                              return;
                            }

                            const response = await fetch(
                              `/api/code/${code.id}`,
                              {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  "x-auth-code": adminCode,
                                },
                                body: JSON.stringify({ disabled: true }),
                              }
                            );

                            if (!response.ok) {
                              const data = await response.json();
                              setError(
                                data.error || "Failed to mark code as used"
                              );
                              return;
                            }

                            const codesResponse = await fetch("/api/code", {
                              headers: {
                                "x-auth-code": adminCode,
                              },
                            });

                            if (!codesResponse.ok) {
                              const data = await codesResponse.json();
                              setError(data.error || "Failed to refresh codes");
                              return;
                            }

                            const codesData = await codesResponse.json();
                            if (Array.isArray(codesData)) {
                              setCodes(codesData);
                              setSuccess(
                                "Kód byl úspešně označen jako použitý"
                              );
                              setError("");
                              setTimeout(() => setSuccess(""), 2000);
                            } else {
                              setError("Invalid response format from server");
                            }
                          } catch (error) {
                            setError("Failed to mark code as used");
                          }
                        }}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Označit jako použitý
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCode(code.id, code.code)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
